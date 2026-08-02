# Phase 5A.1 — Evidence Binary Storage & Secure File Access

Completes Phase 5A by persisting uploaded binaries in object storage and serving them through an authorized, audited download path. Also corrects the evidence metric label. No AI analysis, no compliance scoring, no business-module redesign.

---

## 1. Provider interface

`src/server/storage/types.ts` defines a provider-independent contract:

```ts
interface StorageProvider {
  readonly name: string;
  readonly supportsSignedUrls: boolean;
  put(key, body: Buffer, { contentType, checksum?, fileName? }): Promise<void>;
  get(key): Promise<{ body: Buffer; contentType?; size? }>;
  delete(key): Promise<void>;          // compensating cleanup / future retention job
  exists(key): Promise<boolean>;
  getSignedUrl(key, { expiresInSeconds, fileName? }): Promise<string | null>;
}
```

Implementations:
- **`S3StorageProvider`** (`s3.ts`) — the MVP provider. AWS SDK v3; works unchanged against **AWS S3**, **Cloudflare R2** and **MinIO**.
- **`MemoryStorageProvider`** (`memory.ts`) — development and tests only; cannot sign URLs, so callers fall back to authorized streaming.

`getStorage()` resolves the driver from the environment and memoises it. `setStorageProvider()` is a test/bootstrap hook. **Binaries are never stored in PostgreSQL and never on the serverless filesystem.**

### Selected MVP provider
**S3-compatible** (`STORAGE_DRIVER=s3`). Selection order: explicit `STORAGE_DRIVER` → `S3_BUCKET` present → **in production an unconfigured driver throws `NOT_CONFIGURED` (fail fast)**; only development/test silently fall back to memory.

## 2. Storage-key design

```
evidence/{YYYY}/{MM}/{solutionId}/v{version}/{uuid}-{32 hex chars}/{sanitised-file-name}
```

The UUID + 128 bits of extra entropy make keys unguessable; the date/solution prefix keeps buckets operable. **Keys are opaque**: they are never rendered in the UI, never accepted as input, and never written to audit metadata. Knowing a key grants nothing — every read is authorized by evidence id first.

## 3. Upload consistency strategy

Ordered, with compensation:

1. Validate (type allow-list, extension/MIME agreement, **magic-byte sniff**, non-empty, configurable size ceiling).
2. Derive **true** `sizeBytes` and **SHA-256 checksum** from the bytes — client-declared values are never trusted.
3. `put` the binary under a fresh key.
4. In one DB transaction: create `Evidence` (with `storagePath`, checksum, version 1), create the `INNOVATION_SOLUTION` link, write the audit row, recompute the approval rate.
5. **If the transaction fails → delete the just-written object** (best-effort compensation), then rethrow.

Consequences: a storage failure creates **no** DB record; a DB failure leaves **no** orphan object (worst case, if the compensating delete itself fails, an unreferenced object remains for a retention job — never a row pointing at a missing object).

## 4. Access-control flow (download)

`GET /api/evidence/{id}/download` — the client supplies only the evidence id.

1. Resolve session → `getAccessContext` (APPROVED + ACTIVE only).
2. `requirePermission("evidence.view")` + `requireScope("INNOVATION_SOLUTION", …)`.
3. Resolve access mode: **INTERNAL** (platform/department/organization) → **PARTNER** (active share) → **PUBLISHED** (viewer).
4. **PARTNER** must additionally hold an active share whose `allowedActions` include **`evidence.read`**.
5. **PUBLISHED** (viewer) may fetch **APPROVED** evidence only.
6. Only then: mint a signed URL or read the bytes.

| Principal | Download |
|---|---|
| SYSTEM_ADMIN | Any evidence in scope |
| INTERNAL_EDITOR | Department scope, any review status (incl. rejected/archived — retention/audit) |
| EXTERNAL_PARTNER | Active, unexpired, unrevoked share **with `evidence.read`** |
| VIEWER | APPROVED evidence on a published solution only |

Failures return **404 for both "missing" and "forbidden"**, so existence is never disclosed. Audit: `EVIDENCE_DOWNLOADED` on success, `EVIDENCE_DOWNLOAD_DENIED` (actor + evidence id + reason code only) on denial. Responses are `private, no-store` with `X-Content-Type-Options: nosniff`.

## 5. Signed URL lifetime

`STORAGE_SIGNED_URL_TTL_SECONDS` (default **120s**, clamped to **30–900s**). Signed URLs are used only when `STORAGE_USE_SIGNED_URLS=true` **and** the provider supports them; otherwise the server streams the bytes itself. Either way authorization happens *before* the URL exists.

## 6. Retention / archive behaviour

- **Archiving is metadata-only** — `reviewStatus=ARCHIVED` plus `archivedAt`/`archivedById`. **The binary is retained by default.**
- There is **no user-facing hard delete** in this phase.
- `StorageProvider.delete()` exists solely for (a) compensating cleanup on failed writes and (b) a future privileged retention/maintenance job. It is not exposed through any action or route.

## 7. Replacement & version strategy

`replaceEvidenceFile(actor, evidenceId, file)`:
- Requires `evidence.upload` + scope, and is **internal-only** (partners cannot re-file).
- **Blocked when `reviewStatus` is APPROVED or ARCHIVED** — approved evidence can never be silently overwritten.
- Writes a **new object under a new key** (the previous object is never overwritten or deleted), increments `version`, updates fileName/mimeType/size/checksum/storagePath, and resets `fileProcessingStatus` to `UPLOADED` (a new binary must be re-processed).
- **History**: the previous version's `version/fileName/mimeType/sizeBytes/checksum` are preserved in the append-only `AuditLog` (`EVIDENCE_FILE_REPLACED`, before/after). **No new model was added** — the audit trail already provides immutable, actor-stamped history.
- A DB failure rolls back by deleting the *new* object; the original stays intact.

## 8. Corrected evidence metric

Renamed from "جاهزية الأدلة" to **"نسبة اعتماد الأدلة المرفوعة"** (`computeEvidenceApprovalRate`).

```
numerator   = linked evidence with reviewStatus = APPROVED
denominator = linked evidence EXCLUDING REJECTED and ARCHIVED
```

- **Excluded statuses:** REJECTED, ARCHIVED (both numerator and denominator).
- **Not compliance readiness / DGA readiness** — it says nothing about requirements being satisfied.
- **Not evidence-requirement coverage** — the denominator counts only what was *actually uploaded*. A solution with one approved file scores 100% even if ten required documents were never uploaded. Requirement-coverage scoring remains future work.

The UI states all of this inline. **Column note:** the value is still persisted to `InnovationSolution.evidenceReadinessPct` (created in Phase 2A); the column was deliberately *not* renamed to avoid a cross-module migration — the semantics are documented here and at the call site.

## 9. Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `STORAGE_DRIVER` | auto | `s3` or `memory`; auto-detects `s3` when `S3_BUCKET` is set |
| `S3_BUCKET` | — | Bucket name (required for s3) |
| `S3_REGION` | `auto` | `auto` for Cloudflare R2 |
| `S3_ENDPOINT` | — | R2/MinIO endpoint; empty for AWS S3 |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | — | Omit to use the ambient IAM chain |
| `S3_FORCE_PATH_STYLE` | `false` | `true` for MinIO |
| `STORAGE_USE_SIGNED_URLS` | `false` | Redirect to a pre-signed URL instead of streaming |
| `STORAGE_SIGNED_URL_TTL_SECONDS` | `120` | Clamped to 30–900 |
| `EVIDENCE_MAX_FILE_MB` | `25` | Per-file ceiling (capped at 200) |

Credentials are read server-side only and never logged, serialised, or returned to a client.

## 10. Deployment notes

**Vercel** — set `STORAGE_DRIVER=s3` plus the S3/R2 variables as encrypted project env vars. Nothing is written to the ephemeral filesystem. For large files prefer `STORAGE_USE_SIGNED_URLS=true` so bytes bypass the function (avoiding response-size/duration limits); the authorization check still runs first and only a short-lived URL is handed out. Upload bodies still pass through the server action, so keep `EVIDENCE_MAX_FILE_MB` within the platform's request-body limit.

**Cloudflare R2** — `S3_REGION=auto`, `S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com`.

**MinIO / self-hosting** — `S3_ENDPOINT=http://minio:9000`, `S3_FORCE_PATH_STYLE=true`. No code changes; the same provider is used.

## 11. Tests

`tests/evidence-storage.test.ts` — **24 tests** using the in-memory adapter (no production credentials in CI): key uniqueness/non-guessability, TTL and size-limit configuration, binary persistence, checksum derivation, empty/mismatched-content rejection, storage-failure leaves no DB record, DB-failure cleans up the object, scoped download, cross-department denial, partner without `evidence.read`, partner with an active share, expired/revoked shares, viewer approved-published-only, key-knowledge grants nothing, download audit without key leakage, `NO_BINARY`, replacement creates a new version/object, audit history preservation, APPROVED/ARCHIVED replacement blocked, archive retains the binary, partner cannot replace, replacement rollback.

Phase 5A's suite was migrated to the byte-based API. **Full suite: 216 passing.**

## 12. Remaining limitations

- Uploads are buffered in memory in the server action; very large files would be better served by a direct-to-storage pre-signed **upload** (only download presigning is implemented).
- No antivirus/malware scanning of uploaded binaries.
- No background retention job yet — orphaned objects (only possible if a compensating delete itself fails) are not reclaimed automatically.
- Downloads are audited but not rate-limited (the platform-wide rate-limiting gap from Phase 2B still stands).
- `fileProcessingStatus` remains `UPLOADED`; the extraction pipeline is Phase 5B.
