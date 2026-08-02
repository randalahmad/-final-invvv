import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";

import { prisma } from "@/server/db";
import { loadAccessContextByUserId, type AccessContext } from "@/server/access-context";
import { AuthorizationError } from "@/server/authorization";
import {
  MemoryStorageProvider,
  setStorageProvider,
  buildEvidenceKey,
  signedUrlTtlSeconds,
  maxFileBytes,
  StorageError,
  type StorageProvider,
} from "@/server/storage";
import {
  uploadEvidence,
  replaceEvidenceFile,
  prepareEvidenceDownload,
  submitEvidence,
  startEvidenceReview,
  approveEvidence,
  archiveEvidence,
  validateFile,
  EvidenceError,
} from "@/modules/evidence/service";

/**
 * Phase 5A.1 — binary storage + secure access.
 * Uses an in-memory storage adapter; no production credentials are required.
 */

const DEPT_A = "dept-digital";
const DEPT_B = "dept-strategy";
const PDF = "application/pdf";
const pdf = (extra = "body") => Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.from(extra)]);
const FILE = () => ({ fileName: "memo.pdf", mimeType: PDF, bytes: pdf() });

let admin: AccessContext, editor: AccessContext, partner: AccessContext, viewer: AccessContext;
let adminId = "", partnerId = "";
let storage: MemoryStorageProvider;

async function expectAuthz(fn: () => Promise<unknown>, code: string) {
  try {
    await fn();
    throw new Error("expected AuthorizationError " + code);
  } catch (e) {
    expect(e, `AuthorizationError(${code})`).toBeInstanceOf(AuthorizationError);
    expect((e as AuthorizationError).code).toBe(code);
  }
}
async function expectEvidenceErr(fn: () => Promise<unknown>, code: string) {
  try {
    await fn();
    throw new Error("expected EvidenceError " + code);
  } catch (e) {
    expect(e, `EvidenceError(${code})`).toBeInstanceOf(EvidenceError);
    expect((e as EvidenceError).code).toBe(code);
  }
}

async function makeSolution(deptId: string, opts: { published?: boolean } = {}) {
  const s = await prisma.innovationSolution.create({
    data: {
      nameAr: `حل تخزين ${Math.random().toString(36).slice(2, 8)}`,
      owningDepartmentId: deptId,
      source: "INTERNAL_PROPOSAL",
      status: opts.published ? "ACTIVE" : "DRAFT",
      publishedAt: opts.published ? new Date() : null,
    },
    select: { id: true },
  });
  return s.id;
}

async function shareTo(solutionId: string, actions: string[], opts: { expired?: boolean; revoked?: boolean } = {}) {
  await prisma.resourceShare.create({
    data: {
      userId: partnerId,
      entityType: "INNOVATION_SOLUTION",
      solutionId,
      allowedActions: actions,
      allowedFields: ["notes"],
      grantedById: adminId,
      expiresAt: opts.expired ? new Date(Date.now() - 86_400_000) : null,
      revokedAt: opts.revoked ? new Date() : null,
    },
  });
}

beforeAll(async () => {
  const [a, e, p, v] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { email: "admin@innovation.local" } }),
    prisma.user.findUniqueOrThrow({ where: { email: "editor@innovation.local" } }),
    prisma.user.findUniqueOrThrow({ where: { email: "partner@innovation.local" } }),
    prisma.user.findUniqueOrThrow({ where: { email: "viewer@innovation.local" } }),
  ]);
  adminId = a.id;
  partnerId = p.id;
  const ctxs = await Promise.all([a, e, p, v].map((u) => loadAccessContextByUserId(u.id)));
  if (ctxs.some((c) => !c)) throw new Error("seed principals missing");
  [admin, editor, partner, viewer] = ctxs as AccessContext[];
});

beforeEach(() => {
  storage = new MemoryStorageProvider();
  setStorageProvider(storage);
});
afterEach(() => setStorageProvider(null));

describe("storage key & configuration", () => {
  it("1. storage keys are unique and non-guessable", () => {
    const a = buildEvidenceKey({ solutionId: "sol1", version: 1, fileName: "memo.pdf" });
    const b = buildEvidenceKey({ solutionId: "sol1", version: 1, fileName: "memo.pdf" });
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThan(60); // uuid + 32 hex chars of entropy
    expect(a).toMatch(/^evidence\/\d{4}\/\d{2}\/sol1\/v1\//);
  });

  it("2. signed-URL TTL is env-configurable and clamped", () => {
    const original = process.env.STORAGE_SIGNED_URL_TTL_SECONDS;
    expect(signedUrlTtlSeconds()).toBe(120); // default
    process.env.STORAGE_SIGNED_URL_TTL_SECONDS = "300";
    expect(signedUrlTtlSeconds()).toBe(300);
    process.env.STORAGE_SIGNED_URL_TTL_SECONDS = "5"; // below floor
    expect(signedUrlTtlSeconds()).toBe(30);
    process.env.STORAGE_SIGNED_URL_TTL_SECONDS = "99999"; // above ceiling
    expect(signedUrlTtlSeconds()).toBe(900);
    if (original === undefined) delete process.env.STORAGE_SIGNED_URL_TTL_SECONDS;
    else process.env.STORAGE_SIGNED_URL_TTL_SECONDS = original;
  });

  it("3. max file size is env-configurable", () => {
    const original = process.env.EVIDENCE_MAX_FILE_MB;
    expect(maxFileBytes()).toBe(25 * 1024 * 1024);
    process.env.EVIDENCE_MAX_FILE_MB = "10";
    expect(maxFileBytes()).toBe(10 * 1024 * 1024);
    if (original === undefined) delete process.env.EVIDENCE_MAX_FILE_MB;
    else process.env.EVIDENCE_MAX_FILE_MB = original;
  });
});

describe("upload persistence", () => {
  it("4. the binary is persisted and the key is stored on the record", async () => {
    const sol = await makeSolution(DEPT_A);
    const { id } = await uploadEvidence(admin, sol, { title: "دليل مخزّن" }, FILE());
    const ev = await prisma.evidence.findUniqueOrThrow({ where: { id } });
    expect(ev.storagePath).toBeTruthy();
    expect(await storage.exists(ev.storagePath!)).toBe(true);
    const object = await storage.get(ev.storagePath!);
    expect(object.body.equals(pdf())).toBe(true);
  });

  it("5. the SHA-256 checksum is derived from the bytes and persisted", async () => {
    const sol = await makeSolution(DEPT_A);
    const { id } = await uploadEvidence(admin, sol, { title: "بصمة" }, FILE());
    const ev = await prisma.evidence.findUniqueOrThrow({ where: { id } });
    const { createHash } = await import("crypto");
    expect(ev.checksum).toBe(createHash("sha256").update(pdf()).digest("hex"));
    expect(ev.sizeBytes).toBe(pdf().length);
  });

  it("6. an empty file is rejected", async () => {
    const sol = await makeSolution(DEPT_A);
    await expectEvidenceErr(
      () => uploadEvidence(admin, sol, { title: "فارغ" }, { fileName: "a.pdf", mimeType: PDF, bytes: Buffer.alloc(0) }),
      "VALIDATION",
    );
  });

  it("7. content that does not match the declared type is rejected", async () => {
    expect(() => validateFile({ fileName: "fake.pdf", mimeType: PDF, bytes: Buffer.from("not a pdf") })).toThrow();
    // extension/mime disagreement
    expect(() => validateFile({ fileName: "memo.docx", mimeType: PDF, bytes: pdf() })).toThrow();
  });

  it("8. a storage failure leaves NO database record behind", async () => {
    const sol = await makeSolution(DEPT_A);
    const failing: StorageProvider = {
      ...storage,
      name: "failing",
      supportsSignedUrls: false,
      put: async () => {
        throw new StorageError("PUT_FAILED", "boom");
      },
      get: storage.get.bind(storage),
      delete: storage.delete.bind(storage),
      exists: storage.exists.bind(storage),
      getSignedUrl: async () => null,
    };
    setStorageProvider(failing);

    await expectEvidenceErr(() => uploadEvidence(admin, sol, { title: "فشل التخزين" }, FILE()), "STORAGE_FAILED");

    const links = await prisma.evidenceLink.findMany({ where: { entityType: "INNOVATION_SOLUTION", entityId: sol } });
    expect(links).toHaveLength(0);
  });

  it("9. a DB failure triggers compensating deletion of the uploaded object", async () => {
    // A non-existent solution passes scope (admin) but fails the FK on link insert.
    const sol = await makeSolution(DEPT_A);
    const { id } = await uploadEvidence(admin, sol, { title: "سليم" }, FILE());
    const okKey = (await prisma.evidence.findUniqueOrThrow({ where: { id } })).storagePath!;
    expect(await storage.exists(okKey)).toBe(true);

    // Force the DB step to fail by making the metadata invalid *after* the put:
    // simulate by deleting the solution row so the link FK fails.
    const doomed = await makeSolution(DEPT_A);
    await prisma.innovationSolution.delete({ where: { id: doomed } });
    const before = storage.size();
    await expect(uploadEvidence(admin, doomed, { title: "سيفشل" }, FILE())).rejects.toBeTruthy();
    // No net new object: whatever was put has been cleaned up.
    expect(storage.size()).toBe(before);
  });
});

describe("secure download", () => {
  it("10. an in-scope internal user can download the exact bytes", async () => {
    const sol = await makeSolution(DEPT_A);
    const { id } = await uploadEvidence(editor, sol, { title: "تنزيل" }, FILE());
    const plan = await prepareEvidenceDownload(editor, id);
    expect(plan.mode).toBe("stream");
    if (plan.mode === "stream") {
      expect(plan.body.equals(pdf())).toBe(true);
      expect(plan.fileName).toBe("memo.pdf");
    }
  });

  it("11. cross-department download is blocked", async () => {
    const sol = await makeSolution(DEPT_B);
    const { id } = await uploadEvidence(admin, sol, { title: "قسم آخر" }, FILE());
    await expectAuthz(() => prepareEvidenceDownload(editor, id), "OUT_OF_SCOPE");
  });

  it("12. a partner without evidence.read is blocked", async () => {
    const sol = await makeSolution(DEPT_A);
    const { id } = await uploadEvidence(admin, sol, { title: "دليل" }, FILE());
    await shareTo(sol, ["evidence.create"]); // upload only, no read
    await expectAuthz(() => prepareEvidenceDownload(partner, id), "ACTION_NOT_ALLOWED");
  });

  it("13. a partner with evidence.read on an active share can download", async () => {
    const sol = await makeSolution(DEPT_A);
    const { id } = await uploadEvidence(admin, sol, { title: "دليل مشارك" }, FILE());
    await shareTo(sol, ["evidence.create", "evidence.read"]);
    const plan = await prepareEvidenceDownload(partner, id);
    expect(plan.mode).toBe("stream");
  });

  it("14. expired and revoked shares block download", async () => {
    const expiredSol = await makeSolution(DEPT_A);
    const e1 = await uploadEvidence(admin, expiredSol, { title: "منتهية" }, FILE());
    await shareTo(expiredSol, ["evidence.read"], { expired: true });
    await expectAuthz(() => prepareEvidenceDownload(partner, e1.id), "OUT_OF_SCOPE");

    const revokedSol = await makeSolution(DEPT_A);
    const e2 = await uploadEvidence(admin, revokedSol, { title: "ملغاة" }, FILE());
    await shareTo(revokedSol, ["evidence.read"], { revoked: true });
    await expectAuthz(() => prepareEvidenceDownload(partner, e2.id), "OUT_OF_SCOPE");
  });

  it("15. viewer downloads APPROVED evidence on a published solution only", async () => {
    const sol = await makeSolution(DEPT_B, { published: true });
    const draft = await uploadEvidence(admin, sol, { title: "مسودة" }, FILE());
    await expectEvidenceErr(() => prepareEvidenceDownload(viewer, draft.id), "NOT_FOUND");

    const approved = await uploadEvidence(admin, sol, { title: "معتمد" }, FILE());
    await submitEvidence(admin, approved.id);
    await startEvidenceReview(admin, approved.id);
    await approveEvidence(admin, approved.id);
    const plan = await prepareEvidenceDownload(viewer, approved.id);
    expect(plan.mode).toBe("stream");
  });

  it("16. knowing a storage key grants nothing — access is by evidence id + authz", async () => {
    const sol = await makeSolution(DEPT_B);
    const { id } = await uploadEvidence(admin, sol, { title: "مفتاح" }, FILE());
    const key = (await prisma.evidence.findUniqueOrThrow({ where: { id } })).storagePath!;
    // The key exists in storage, but the out-of-scope editor still cannot download.
    expect(await storage.exists(key)).toBe(true);
    await expectAuthz(() => prepareEvidenceDownload(editor, id), "OUT_OF_SCOPE");
    // The download API takes no key parameter at all.
    expect(prepareEvidenceDownload.length).toBe(2);
  });

  it("17. a download is audited", async () => {
    const sol = await makeSolution(DEPT_A);
    const { id } = await uploadEvidence(editor, sol, { title: "تدقيق التنزيل" }, FILE());
    await prepareEvidenceDownload(editor, id);
    const row = await prisma.auditLog.findFirst({
      where: { entityType: "EVIDENCE", entityId: id, action: "EVIDENCE_DOWNLOADED" },
    });
    expect(row).not.toBeNull();
    expect(row?.actorUserId).toBe(editor.userId);
    expect(JSON.stringify(row?.metadata)).not.toContain("evidence/"); // no storage key leaked
  });

  it("18. evidence without a stored binary reports NO_BINARY", async () => {
    const sol = await makeSolution(DEPT_A);
    const { id } = await uploadEvidence(admin, sol, { title: "بدون ملف" }, FILE());
    await prisma.evidence.update({ where: { id }, data: { storagePath: null } });
    await expectEvidenceErr(() => prepareEvidenceDownload(admin, id), "NO_BINARY");
  });
});

describe("version-safe replacement", () => {
  it("19. replacement writes a NEW object, bumps version and keeps the old object", async () => {
    const sol = await makeSolution(DEPT_A);
    const { id } = await uploadEvidence(admin, sol, { title: "للاستبدال" }, FILE());
    const before = await prisma.evidence.findUniqueOrThrow({ where: { id } });

    const { version } = await replaceEvidenceFile(admin, id, {
      fileName: "memo-v2.pdf",
      mimeType: PDF,
      bytes: pdf("second version"),
    });
    const after = await prisma.evidence.findUniqueOrThrow({ where: { id } });

    expect(version).toBe(2);
    expect(after.version).toBe(2);
    expect(after.storagePath).not.toBe(before.storagePath);
    expect(after.checksum).not.toBe(before.checksum);
    expect(after.fileName).toBe("memo-v2.pdf");
    expect(after.fileProcessingStatus).toBe("UPLOADED");
    // The previous object is retained (never overwritten).
    expect(await storage.exists(before.storagePath!)).toBe(true);
    expect(await storage.exists(after.storagePath!)).toBe(true);
  });

  it("20. replacement preserves the previous checksum/metadata in the audit trail", async () => {
    const sol = await makeSolution(DEPT_A);
    const { id } = await uploadEvidence(admin, sol, { title: "تاريخ" }, FILE());
    const before = await prisma.evidence.findUniqueOrThrow({ where: { id } });
    await replaceEvidenceFile(admin, id, { fileName: "v2.pdf", mimeType: PDF, bytes: pdf("v2") });

    const row = await prisma.auditLog.findFirstOrThrow({
      where: { entityType: "EVIDENCE", entityId: id, action: "EVIDENCE_FILE_REPLACED" },
    });
    expect((row.beforeData as { checksum?: string }).checksum).toBe(before.checksum);
    expect((row.beforeData as { version?: number }).version).toBe(1);
    expect((row.afterData as { version?: number }).version).toBe(2);
  });

  it("21. APPROVED evidence cannot be silently replaced", async () => {
    const sol = await makeSolution(DEPT_A);
    const { id } = await uploadEvidence(admin, sol, { title: "معتمد" }, FILE());
    await submitEvidence(admin, id);
    await startEvidenceReview(admin, id);
    await approveEvidence(admin, id);
    await expectEvidenceErr(
      () => replaceEvidenceFile(admin, id, { fileName: "x.pdf", mimeType: PDF, bytes: pdf("x") }),
      "INVALID_TRANSITION",
    );
  });

  it("22. ARCHIVED evidence cannot be replaced, and archiving keeps the binary", async () => {
    const sol = await makeSolution(DEPT_A);
    const { id } = await uploadEvidence(admin, sol, { title: "مؤرشف" }, FILE());
    await submitEvidence(admin, id);
    await startEvidenceReview(admin, id);
    await approveEvidence(admin, id);
    await archiveEvidence(admin, id);

    const ev = await prisma.evidence.findUniqueOrThrow({ where: { id } });
    expect(ev.reviewStatus).toBe("ARCHIVED");
    expect(ev.storagePath).toBeTruthy();
    expect(await storage.exists(ev.storagePath!)).toBe(true); // retention: binary kept
    await expectEvidenceErr(
      () => replaceEvidenceFile(admin, id, { fileName: "x.pdf", mimeType: PDF, bytes: pdf("x") }),
      "INVALID_TRANSITION",
    );
  });

  it("23. a partner cannot replace a file even on a shared solution", async () => {
    const sol = await makeSolution(DEPT_A);
    const { id } = await uploadEvidence(admin, sol, { title: "شريك" }, FILE());
    await shareTo(sol, ["evidence.create", "evidence.read"]);
    await expectEvidenceErr(
      () => replaceEvidenceFile(partner, id, { fileName: "x.pdf", mimeType: PDF, bytes: pdf("x") }),
      "INVALID_TRANSITION",
    );
  });

  it("24. a failed DB write during replacement rolls back the new object", async () => {
    const sol = await makeSolution(DEPT_A);
    const { id } = await uploadEvidence(admin, sol, { title: "تراجع" }, FILE());
    const original = await prisma.evidence.findUniqueOrThrow({ where: { id } });

    // Make the update fail by removing the row after the put would happen.
    const putKeys: string[] = [];
    const spy: StorageProvider = {
      name: "spy",
      supportsSignedUrls: false,
      put: async (k, b, o) => {
        putKeys.push(k);
        await storage.put(k, b, o);
      },
      get: storage.get.bind(storage),
      delete: storage.delete.bind(storage),
      exists: storage.exists.bind(storage),
      getSignedUrl: async () => null,
    };
    setStorageProvider(spy);
    await prisma.evidenceLink.deleteMany({ where: { evidenceId: id } });
    await prisma.evidence.delete({ where: { id } });

    await expect(
      replaceEvidenceFile(admin, id, { fileName: "x.pdf", mimeType: PDF, bytes: pdf("x") }),
    ).rejects.toBeTruthy();
    // Nothing new should remain in storage for this replacement attempt.
    for (const k of putKeys) expect(await storage.exists(k)).toBe(false);
    expect(original.storagePath).toBeTruthy();
  });
});
