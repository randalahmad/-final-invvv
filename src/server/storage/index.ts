import { randomBytes, randomUUID } from "crypto";

import { MemoryStorageProvider } from "./memory";
import { StorageError, type StorageProvider } from "./types";

export * from "./types";
export { MemoryStorageProvider } from "./memory";

/** Signed-URL lifetime (seconds): env-configurable, clamped to a safe range. */
export function signedUrlTtlSeconds(): number {
  const raw = Number(process.env.STORAGE_SIGNED_URL_TTL_SECONDS ?? 120);
  if (!Number.isFinite(raw)) return 120;
  return Math.min(Math.max(Math.trunc(raw), 30), 900); // 30s … 15min
}

/** Prefer redirecting to a provider-signed URL instead of streaming bytes. */
export function signedUrlsEnabled(): boolean {
  return process.env.STORAGE_USE_SIGNED_URLS === "true";
}

/** Configurable per-file ceiling (MB → bytes), default 25 MB. */
export function maxFileBytes(): number {
  const mb = Number(process.env.EVIDENCE_MAX_FILE_MB ?? 25);
  const safe = Number.isFinite(mb) && mb > 0 ? Math.min(mb, 200) : 25;
  return Math.trunc(safe * 1024 * 1024);
}

/**
 * Build a non-guessable storage key. The random component (UUID + 16 random
 * bytes) makes enumeration infeasible; the prefix keeps objects browsable for
 * operations. The key is opaque and is never returned to clients.
 */
export function buildEvidenceKey(input: { solutionId: string; version: number; fileName: string }): string {
    const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80) || "file";
  const nonce = `${randomUUID()}-${randomBytes(16).toString("hex")}`;
  return `evidence/${yyyy}/${mm}/${input.solutionId}/v${input.version}/${nonce}/${safeName}`;
}

/** Same construction as buildEvidenceKey, keyed by an arbitrary entity id (StrategyDocument, activity, etc). */
export function buildEntityEvidenceKey(input: { namespace: string; entityId: string; fileName: string }): string {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80) || "file";
  const nonce = `${randomUUID()}-${randomBytes(16).toString("hex")}`;
  return `evidence/${input.namespace}/${yyyy}/${mm}/${input.entityId}/${nonce}/${safeName}`;
}

let override: StorageProvider | null = null;
let cached: StorageProvider | null = null;

/** Test/bootstrap hook — inject a provider (e.g. in-memory or a failing fake). */
export function setStorageProvider(provider: StorageProvider | null): void {
  override = provider;
  if (provider) cached = null;
}

function resolveDriver(): "s3" | "memory" {
  const explicit = process.env.STORAGE_DRIVER?.trim().toLowerCase();
  if (explicit === "s3" || explicit === "memory") return explicit;
  if (process.env.S3_BUCKET) return "s3";
  if (process.env.NODE_ENV === "production") {
    throw new StorageError(
      "NOT_CONFIGURED",
      "No object storage configured. Set S3_BUCKET (+ credentials) or STORAGE_DRIVER explicitly.",
    );
  }
  return "memory";
}

/** Resolve the configured provider (memoised). Never exposes credentials. */
export async function getStorage(): Promise<StorageProvider> {
  if (override) return override;
  if (cached) return cached;

  if (resolveDriver() === "s3") {
    const bucket = process.env.S3_BUCKET;
    if (!bucket) throw new StorageError("NOT_CONFIGURED", "S3_BUCKET is required when STORAGE_DRIVER=s3");
    const { createS3Storage } = await import("./s3");
    cached = createS3Storage({
      bucket,
      region: process.env.S3_REGION ?? "auto",
      endpoint: process.env.S3_ENDPOINT || undefined,
      accessKeyId: process.env.S3_ACCESS_KEY_ID || undefined,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || undefined,
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    });
  } else {
    cached = new MemoryStorageProvider();
  }
  return cached;
}
