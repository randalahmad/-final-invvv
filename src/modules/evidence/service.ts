import { createHash } from "crypto";

import type { EvidenceReviewStatus, LinkedEntityType, Prisma } from "@prisma/client";

import { prisma } from "@/server/db";
import {
  getStorage,
  buildEvidenceKey,
  buildEntityEvidenceKey,
  maxFileBytes,
  signedUrlTtlSeconds,
  signedUrlsEnabled,
  StorageError,
} from "@/server/storage";
import { writeAudit, AUDIT } from "@/server/audit";
import type { AccessContext } from "@/server/access-context";
import {
  requirePermission,
  requireScope,
  requireDepartmentScope,
  effectiveScopes,
  findActiveShareForEntity,
  requireShareAction,
} from "@/server/authorization";
import { enqueueAnalysisRecord, formatFromMime } from "@/modules/document-analysis/service";
import {
  evidenceMetadataSchema,
  evidenceLinkSchema,
  ALLOWED_MIME_TYPES,
  type EvidenceMetadataInput,
} from "./schema";

export type EvidenceErrorCode =
  | "VALIDATION"
  | "INVALID_TRANSITION"
  | "UNSUPPORTED_FILE"
  | "FILE_TOO_LARGE"
  | "DUPLICATE"
  | "BAD_REFERENCE"
  | "NOT_FOUND"
  | "STORAGE_FAILED"
  | "NO_BINARY";

export class EvidenceError extends Error {
  code: EvidenceErrorCode;
  fieldErrors?: Record<string, string[]>;
  constructor(code: EvidenceErrorCode, message?: string, fieldErrors?: Record<string, string[]>, cause?: unknown) {
    super(message ?? code, cause === undefined ? undefined : { cause });
    this.name = "EvidenceError";
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

const VIEW = "evidence.view" as const;
const UPLOAD = "evidence.upload" as const;
const APPROVE = "evidence.approve" as const;

/** Governance transitions (status-definitions.md §11). */
const REVIEW_TRANSITIONS: Record<EvidenceReviewStatus, EvidenceReviewStatus[]> = {
  DRAFT: ["SUBMITTED"],
  SUBMITTED: ["UNDER_REVIEW"],
  UNDER_REVIEW: ["NEEDS_AMENDMENT", "PENDING_APPROVAL", "REJECTED"],
  NEEDS_AMENDMENT: ["DRAFT", "SUBMITTED"],
  PENDING_APPROVAL: ["APPROVED", "NEEDS_AMENDMENT", "REJECTED"],
  APPROVED: ["NEEDS_UPDATE", "ARCHIVED"],
  NEEDS_UPDATE: ["DRAFT", "ARCHIVED"],
  REJECTED: ["DRAFT", "ARCHIVED"],
  ARCHIVED: [],
};

export type AccessMode = "INTERNAL" | "PARTNER" | "PUBLISHED";

type SolutionCtx = { id: string; owningDepartmentId: string | null; organizationId: string | null };

async function loadSolutionCtx(solutionId: string): Promise<SolutionCtx> {
  const s = await prisma.innovationSolution.findUnique({
    where: { id: solutionId },
    select: { id: true, owningDepartmentId: true, owningDepartment: { select: { organizationId: true } } },
  });
  if (!s) throw new EvidenceError("NOT_FOUND", "الحل غير موجود");
  return { id: s.id, owningDepartmentId: s.owningDepartmentId, organizationId: s.owningDepartment?.organizationId ?? null };
}

/**
 * How this principal reaches the solution: as an internal (department /
 * organization / platform) user, through an active ResourceShare (partner), or
 * only via the PUBLISHED projection (viewer).
 */
async function resolveAccessMode(actor: AccessContext, solution: SolutionCtx): Promise<AccessMode> {
  const es = effectiveScopes(actor);
  if (es.platform) return "INTERNAL";
  if (solution.owningDepartmentId && es.departmentIds.includes(solution.owningDepartmentId)) return "INTERNAL";
  if (solution.organizationId && es.organizationIds.includes(solution.organizationId)) return "INTERNAL";
  const share = await findActiveShareForEntity(actor.userId, "INNOVATION_SOLUTION", solution.id);
  return share ? "PARTNER" : "PUBLISHED";
}

/** Read gate: evidence.view + solution scope. Published-only readers see APPROVED evidence only. */
async function requireEvidenceRead(actor: AccessContext, solutionId: string) {
  requirePermission(actor, VIEW);
  await requireScope(actor, "INNOVATION_SOLUTION", solutionId);
  const solution = await loadSolutionCtx(solutionId);
  const mode = await resolveAccessMode(actor, solution);
  return { solution, mode };
}

/**
 * Upload gate. Internal users need `evidence.upload` within scope. A partner
 * reaching the solution only through a share must additionally hold an ACTIVE
 * share whose allowedActions include `evidence.create`.
 */
async function requireEvidenceUpload(actor: AccessContext, solutionId: string) {
  requirePermission(actor, UPLOAD);
  await requireScope(actor, "INNOVATION_SOLUTION", solutionId);
  const solution = await loadSolutionCtx(solutionId);
  const mode = await resolveAccessMode(actor, solution);
  if (mode !== "INTERNAL") {
    // Partners (and anyone not internally scoped) must be explicitly permitted.
    await requireShareAction(actor, "INNOVATION_SOLUTION", solution.id, "evidence.create");
  }
  return { solution, mode };
}

/** The solution an evidence item belongs to (its INNOVATION_SOLUTION link). */
async function solutionIdForEvidence(evidenceId: string): Promise<string> {
  const link = await prisma.evidenceLink.findFirst({
    where: { evidenceId, entityType: "INNOVATION_SOLUTION" },
    select: { entityId: true },
  });
  if (!link) throw new EvidenceError("NOT_FOUND", "الدليل غير مرتبط بحل");
  return link.entityId;
}

// ── Evidence readiness ─────────────────────────────────────────────────────

export interface EvidenceApprovalRate {
  percentage: number;
  approved: number;
  /** Uploaded-and-tracked evidence — NOT a set of required evidence. */
  tracked: number;
}

/**
 * APPROVAL RATE OF UPLOADED EVIDENCE — "نسبة اعتماد الأدلة المرفوعة".
 *
 *   numerator   = evidence linked to the solution with reviewStatus = APPROVED
 *   denominator = evidence linked to the solution, EXCLUDING REJECTED and ARCHIVED
 *
 * What it is NOT:
 *  - NOT compliance readiness / DGA readiness / an estimated readiness score.
 *  - NOT evidence-requirement coverage: the denominator counts only what was
 *    actually uploaded, so required-but-missing evidence is invisible to it.
 *    A solution with one approved file scores 100% even if ten required
 *    documents were never uploaded. Requirement-coverage scoring is future work.
 */
export async function computeEvidenceApprovalRate(solutionId: string, db: Prisma.TransactionClient | typeof prisma = prisma): Promise<EvidenceApprovalRate> {
  const links = await db.evidenceLink.findMany({
    where: { entityType: "INNOVATION_SOLUTION", entityId: solutionId },
    select: { evidenceId: true },
  });
  const ids = links.map((l) => l.evidenceId);
  if (ids.length === 0) return { percentage: 0, approved: 0, tracked: 0 };

  const [tracked, approved] = await Promise.all([
    db.evidence.count({ where: { id: { in: ids }, reviewStatus: { notIn: ["ARCHIVED", "REJECTED"] } } }),
    db.evidence.count({ where: { id: { in: ids }, reviewStatus: "APPROVED" } }),
  ]);
  return { percentage: tracked > 0 ? Math.round((approved / tracked) * 100) : 0, approved, tracked };
}

/**
 * Persist the approval rate. NOTE: the column is still named
 * `evidenceReadinessPct` (created in Phase 2A); the stored value is the
 * approval rate defined above. The column was intentionally not renamed to
 * avoid a cross-module migration — the semantics are documented here and in
 * docs/architecture/phase-5a1-evidence-storage.md.
 */
async function recomputeAndStoreReadiness(db: Prisma.TransactionClient, solutionId: string) {
  const rate = await computeEvidenceApprovalRate(solutionId, db);
  await db.innovationSolution.update({ where: { id: solutionId }, data: { evidenceReadinessPct: rate.percentage } });
  return rate;
}

// ── Registry ───────────────────────────────────────────────────────────────

export interface EvidenceFilters {
  q?: string;
  reviewStatus?: string;
  fileProcessingStatus?: string;
  includeArchived?: boolean;
}

export async function listSolutionEvidence(actor: AccessContext, solutionId: string, filters: EvidenceFilters = {}) {
  const { mode } = await requireEvidenceRead(actor, solutionId);

  const links = await prisma.evidenceLink.findMany({
    where: { entityType: "INNOVATION_SOLUTION", entityId: solutionId },
    select: { evidenceId: true },
  });
  const ids = links.map((l) => l.evidenceId);
  if (ids.length === 0) return [];

  const and: Prisma.EvidenceWhereInput[] = [{ id: { in: ids } }];
  // Published-only readers never see anything but approved evidence.
  if (mode === "PUBLISHED") and.push({ reviewStatus: "APPROVED" });
  else if (!filters.includeArchived) and.push({ reviewStatus: { not: "ARCHIVED" } });
  if (filters.reviewStatus) and.push({ reviewStatus: filters.reviewStatus as EvidenceReviewStatus });
  if (filters.fileProcessingStatus) and.push({ fileProcessingStatus: filters.fileProcessingStatus as never });
  if (filters.q?.trim()) {
    const q = filters.q.trim();
    and.push({ OR: [{ title: { contains: q, mode: "insensitive" } }, { fileName: { contains: q, mode: "insensitive" } }] });
  }

  return prisma.evidence.findMany({
    where: { AND: and },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, title: true, fileName: true, mimeType: true, sizeBytes: true,
      reviewStatus: true, fileProcessingStatus: true, classification: true,
      createdAt: true, approvedAt: true, archivedAt: true,
      uploadedBy: { select: { name: true } },
    },
  });
}

export async function getEvidenceById(actor: AccessContext, evidenceId: string) {
  const solutionId = await solutionIdForEvidence(evidenceId);
  const { mode } = await requireEvidenceRead(actor, solutionId);

  const evidence = await prisma.evidence.findUnique({
    where: { id: evidenceId },
    select: {
      id: true, title: true, notes: true, classification: true, fileName: true, mimeType: true,
      sizeBytes: true, checksum: true, version: true, storagePath: true,
      reviewStatus: true, fileProcessingStatus: true, verificationStatus: true,
      reviewedById: true, reviewedAt: true, approvedById: true, approvedAt: true,
      createdAt: true, updatedAt: true, archivedAt: true,
      uploadedById: true,
      uploadedBy: { select: { name: true } },
    },
  });
  if (!evidence) throw new EvidenceError("NOT_FOUND", "الدليل غير موجود");
  if (mode === "PUBLISHED" && evidence.reviewStatus !== "APPROVED") {
    throw new EvidenceError("NOT_FOUND", "الدليل غير متاح");
  }
  return { ...evidence, solutionId };
}

// ── Upload ─────────────────────────────────────────────────────────────────

/** The actual uploaded bytes plus the client-declared name/type. */
export interface EvidenceFileInput {
  fileName: string;
  mimeType: string;
  bytes: Buffer;
}

/** Magic-byte signatures — guards against a mislabelled content type. */
function magicMatches(mimeType: string, bytes: Buffer): boolean {
  if (bytes.length < 4) return false;
  if (mimeType === "application/pdf") return bytes.subarray(0, 5).toString("latin1") === "%PDF-";
  // DOCX/XLSX are ZIP containers.
  return bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

export interface ValidatedFile {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  checksum: string;
  bytes: Buffer;
}

/**
 * Validate type, extension/content agreement, emptiness and the configurable
 * size ceiling, then derive the true size and SHA-256 checksum from the bytes
 * (client-declared values are never trusted).
 */
export function validateFile(file: EvidenceFileInput): ValidatedFile {
  const allowed = ALLOWED_MIME_TYPES[file.mimeType];
  if (!allowed) {
    throw new EvidenceError("UNSUPPORTED_FILE", "نوع الملف غير مدعوم. المسموح: PDF أو DOCX أو XLSX");
  }
  if (!file.bytes || file.bytes.length === 0) {
    throw new EvidenceError("VALIDATION", "الملف فارغ");
  }
  const ext = file.fileName.split(".").pop()?.toLowerCase() ?? "";
  if (ext !== allowed.ext) {
    throw new EvidenceError("UNSUPPORTED_FILE", "امتداد الملف لا يطابق نوعه");
  }
  if (!magicMatches(file.mimeType, file.bytes)) {
    throw new EvidenceError("UNSUPPORTED_FILE", "محتوى الملف لا يطابق النوع المُعلن");
  }
  const limit = maxFileBytes();
  if (file.bytes.length > limit) {
    throw new EvidenceError("FILE_TOO_LARGE", `حجم الملف يتجاوز الحد المسموح (${Math.round(limit / (1024 * 1024))} ميغابايت)`);
  }
  return {
    fileName: file.fileName,
    mimeType: file.mimeType,
    sizeBytes: file.bytes.length,
    checksum: createHash("sha256").update(file.bytes).digest("hex"),
    bytes: file.bytes,
  };
}

/**
 * Register an evidence item against a solution. Creates the Evidence record
 * (reviewStatus=DRAFT, fileProcessingStatus=UPLOADED) plus its
 * INNOVATION_SOLUTION link, audits, and refreshes evidence readiness.
 */
export async function uploadEvidence(
  actor: AccessContext,
  solutionId: string,
  raw: unknown,
  file: EvidenceFileInput,
): Promise<{ id: string }> {
  const { solution } = await requireEvidenceUpload(actor, solutionId);
  const parsed = evidenceMetadataSchema.safeParse(raw);
  if (!parsed.success) throw new EvidenceError("VALIDATION", "invalid", parsed.error.flatten().fieldErrors);
  const validated = validateFile(file);
  const meta: EvidenceMetadataInput = parsed.data;

  // Consistency strategy: put the binary first, then persist metadata. If the
  // DB write fails we compensate by deleting the just-written object, so a
  // storage object never outlives a missing DB row (and no row ever points at
  // a missing object).
  const key = buildEvidenceKey({ solutionId, version: 1, fileName: validated.fileName });
  const storage = await getStorage();
  try {
    await storage.put(key, validated.bytes, {
      contentType: validated.mimeType,
      checksum: validated.checksum,
      fileName: validated.fileName,
    });
  } catch (e) {
    throw new EvidenceError("STORAGE_FAILED", "تعذّر تخزين الملف. لم يتم إنشاء أي سجل.", undefined, e);
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const created = await tx.evidence.create({
        data: {
          title: meta.title,
          notes: meta.description, // Evidence has no `description` column — mapped to notes
          classification: meta.classification,
          fileName: validated.fileName,
          mimeType: validated.mimeType,
          sizeBytes: validated.sizeBytes,
          checksum: validated.checksum,
          storagePath: key,
          version: 1,
          uploadedById: actor.userId,
          reviewStatus: "DRAFT",
          fileProcessingStatus: "UPLOADED",
        },
        select: { id: true },
      });
      await tx.evidenceLink.create({
        data: { evidenceId: created.id, entityType: "INNOVATION_SOLUTION", entityId: solutionId },
      });
      await writeAudit(
        {
          actorUserId: actor.userId,
          action: AUDIT.EVIDENCE_UPLOADED,
          entityType: "EVIDENCE",
          entityId: created.id,
          departmentId: solution.owningDepartmentId,
          summary: "رفع دليل جديد",
          // Never log the storage key or any credential.
          metadata: {
            solutionId,
            fileName: validated.fileName,
            mimeType: validated.mimeType,
            sizeBytes: validated.sizeBytes,
            checksum: validated.checksum,
            version: 1,
          },
          after: { reviewStatus: "DRAFT", fileProcessingStatus: "UPLOADED" },
        },
        tx,
      );
      await recomputeAndStoreReadiness(tx, solutionId);
      // Enqueue AI document analysis (job only — extraction runs on demand and
      // never auto-approves). Supported formats only.
      const format = formatFromMime(validated.mimeType);
      if (format) await enqueueAnalysisRecord(tx, created.id, format, actor.userId);
      return created;
    });
  } catch (dbError) {
    // Compensating cleanup — best effort; never mask the original failure.
    try {
      await storage.delete(key);
    } catch {
      /* orphan object; retention job will reclaim it */
    }
    throw dbError;
  }
}

// ── Lifecycle ──────────────────────────────────────────────────────────────

function assertTransition(from: EvidenceReviewStatus, to: EvidenceReviewStatus) {
  if (!REVIEW_TRANSITIONS[from].includes(to)) {
    throw new EvidenceError("INVALID_TRANSITION", "انتقال غير مسموح لحالة الدليل");
  }
}

async function transition(
  actor: AccessContext,
  evidenceId: string,
  to: EvidenceReviewStatus,
  opts: { permission: typeof UPLOAD | typeof APPROVE; action: string; summary: string; uploaderAllowed?: boolean; extra?: Prisma.EvidenceUpdateInput; note?: string },
) {
  const solutionId = await solutionIdForEvidence(evidenceId);
  requirePermission(actor, opts.permission);
  await requireScope(actor, "INNOVATION_SOLUTION", solutionId);
  const solution = await loadSolutionCtx(solutionId);

  const evidence = await prisma.evidence.findUnique({
    where: { id: evidenceId },
    select: { id: true, reviewStatus: true, uploadedById: true },
  });
  if (!evidence) throw new EvidenceError("NOT_FOUND", "الدليل غير موجود");
  assertTransition(evidence.reviewStatus, to);

  // Submitting is the uploader's action; reviewers act via evidence.approve.
  if (opts.uploaderAllowed) {
    const mode = await resolveAccessMode(actor, solution);
    const isUploader = evidence.uploadedById === actor.userId;
    if (!isUploader && mode !== "INTERNAL") throw new EvidenceError("INVALID_TRANSITION", "التقديم من صلاحية صاحب الرفع");
  }

  return prisma.$transaction(async (tx) => {
    await tx.evidence.update({ where: { id: evidenceId }, data: { reviewStatus: to, ...(opts.extra ?? {}) } });
    await writeAudit(
      {
        actorUserId: actor.userId,
        action: opts.action,
        entityType: "EVIDENCE",
        entityId: evidenceId,
        departmentId: solution.owningDepartmentId,
        summary: opts.summary,
        before: { reviewStatus: evidence.reviewStatus },
        after: { reviewStatus: to },
        metadata: { solutionId, ...(opts.note ? { note: opts.note } : {}) },
      },
      tx,
    );
    const readiness = await recomputeAndStoreReadiness(tx, solutionId);
    return readiness;
  });
}

// ── Activity evidence (additive — does not touch uploadEvidence/solution paths) ──
//
// Reuses the same Evidence/EvidenceLink tables and the same buildEvidenceKey/
// validateFile helpers as solution evidence, unmodified. Authorization here
// uses activity.view/activity.manage (the activities module's own
// permissions), not evidence.view/evidence.upload, per the explicit
// requirement to reuse the activities module's existing permissions.
const ACTIVITY_VIEW = "activity.view" as const;
const ACTIVITY_MANAGE = "activity.manage" as const;

async function requireActivityScope(
  actor: AccessContext,
  activityId: string,
  permission: typeof ACTIVITY_VIEW | typeof ACTIVITY_MANAGE,
) {
  requirePermission(actor, permission);
  const activity = await prisma.innovationActivity.findUnique({
    where: { id: activityId },
    select: { id: true, organizerDepartmentId: true },
  });
  if (!activity) throw new EvidenceError("BAD_REFERENCE", "النشاط غير موجود");
  await requireDepartmentScope(actor, activity.organizerDepartmentId ?? "__none__");
  return activity;
}

export async function uploadActivityEvidence(
  actor: AccessContext,
  activityId: string,
  raw: unknown,
  file: EvidenceFileInput,
): Promise<{ id: string }> {
  const activity = await requireActivityScope(actor, activityId, ACTIVITY_MANAGE);
  const parsed = evidenceMetadataSchema.safeParse(raw);
  if (!parsed.success) throw new EvidenceError("VALIDATION", "invalid", parsed.error.flatten().fieldErrors);
  const validated = validateFile(file);
  const meta: EvidenceMetadataInput = parsed.data;

  // buildEvidenceKey is reused exactly as-is (unmodified) — its "solutionId"
  // parameter is just a storage-path namespace segment, safe to reuse for
  // any entity id.
  const key = buildEvidenceKey({ solutionId: activityId, version: 1, fileName: validated.fileName });
  const storage = await getStorage();
  try {
    await storage.put(key, validated.bytes, { contentType: validated.mimeType, checksum: validated.checksum, fileName: validated.fileName });
  } catch (e) {
    throw new EvidenceError("STORAGE_FAILED", "تعذّر تخزين الملف. لم يتم إنشاء أي سجل.", undefined, e);
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const created = await tx.evidence.create({
        data: {
          title: meta.title,
          notes: meta.description,
          classification: meta.classification,
          fileName: validated.fileName,
          mimeType: validated.mimeType,
          sizeBytes: validated.sizeBytes,
          checksum: validated.checksum,
          storagePath: key,
          version: 1,
          uploadedById: actor.userId,
          reviewStatus: "DRAFT",
          fileProcessingStatus: "UPLOADED",
        },
        select: { id: true },
      });
      await tx.evidenceLink.create({
        data: { evidenceId: created.id, entityType: "INNOVATION_ACTIVITY", entityId: activityId },
      });
      await writeAudit(
        {
          actorUserId: actor.userId,
          action: AUDIT.EVIDENCE_UPLOADED,
          entityType: "EVIDENCE",
          entityId: created.id,
          departmentId: activity.organizerDepartmentId,
          summary: "رفع دليل جديد",
          metadata: {
            activityId,
            fileName: validated.fileName,
            mimeType: validated.mimeType,
            sizeBytes: validated.sizeBytes,
            checksum: validated.checksum,
            version: 1,
          },
          after: { reviewStatus: "DRAFT", fileProcessingStatus: "UPLOADED" },
        },
        tx,
      );
      return created;
    });
  } catch (dbError) {
    try {
      await storage.delete(key);
    } catch {
      /* orphan object; retention job will reclaim it */
    }
    throw dbError;
  }
}

export interface ActivityEvidenceFilters {
  q?: string;
  includeArchived?: boolean;
}

export async function listActivityEvidence(actor: AccessContext, activityId: string, filters: ActivityEvidenceFilters = {}) {
  await requireActivityScope(actor, activityId, ACTIVITY_VIEW);

  const links = await prisma.evidenceLink.findMany({
    where: { entityType: "INNOVATION_ACTIVITY", entityId: activityId },
    select: { evidenceId: true },
  });
  const ids = links.map((l) => l.evidenceId);
  if (ids.length === 0) return [];

  const and: Prisma.EvidenceWhereInput[] = [{ id: { in: ids } }];
  if (!filters.includeArchived) and.push({ reviewStatus: { not: "ARCHIVED" } });
  if (filters.q?.trim()) {
    const q = filters.q.trim();
    and.push({ OR: [{ title: { contains: q, mode: "insensitive" } }, { fileName: { contains: q, mode: "insensitive" } }] });
  }

  return prisma.evidence.findMany({
    where: { AND: and },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      fileName: true,
      mimeType: true,
      sizeBytes: true,
      reviewStatus: true,
      fileProcessingStatus: true,
      classification: true,
      createdAt: true,
      approvedAt: true,
      archivedAt: true,
      uploadedBy: { select: { name: true } },
    },
  });
}

/** DRAFT → SUBMITTED (uploader, or an internal in-scope user). */
export async function submitEvidence(actor: AccessContext, evidenceId: string) {
  return transition(actor, evidenceId, "SUBMITTED", {
    permission: UPLOAD,
    action: AUDIT.EVIDENCE_SUBMITTED,
    summary: "تقديم الدليل للمراجعة",
    uploaderAllowed: true,
  });
}

/** SUBMITTED → UNDER_REVIEW (reviewer). */
export async function startEvidenceReview(actor: AccessContext, evidenceId: string) {
  return transition(actor, evidenceId, "UNDER_REVIEW", {
    permission: APPROVE,
    action: AUDIT.EVIDENCE_REVIEW_STARTED,
    summary: "بدء مراجعة الدليل",
    extra: { reviewedById: actor.userId, reviewedAt: new Date() },
  });
}

/** UNDER_REVIEW → APPROVED — the only status that counts toward evidence readiness. */
export async function approveEvidence(actor: AccessContext, evidenceId: string) {
  return transition(actor, evidenceId, "APPROVED", {
    permission: APPROVE,
    action: AUDIT.EVIDENCE_APPROVED,
    summary: "اعتماد الدليل",
    extra: { approvedById: actor.userId, approvedAt: new Date() },
  });
}

/** UNDER_REVIEW → REJECTED. */
export async function rejectEvidence(actor: AccessContext, evidenceId: string, reason?: string) {
  return transition(actor, evidenceId, "REJECTED", {
    permission: APPROVE,
    action: AUDIT.EVIDENCE_REJECTED,
    summary: "رفض الدليل",
    note: reason?.trim() || undefined,
    extra: { reviewedById: actor.userId, reviewedAt: new Date() },
  });
}

/** APPROVED/REJECTED → ARCHIVED (soft; never a hard delete). */
export async function archiveEvidence(actor: AccessContext, evidenceId: string) {
  return transition(actor, evidenceId, "ARCHIVED", {
    permission: APPROVE,
    action: AUDIT.EVIDENCE_ARCHIVED,
    summary: "أرشفة الدليل",
    extra: { archivedAt: new Date(), archivedById: actor.userId },
  });
}

// ── Secure download ────────────────────────────────────────────────────────

export type DownloadPlan =
  | { mode: "redirect"; url: string; fileName: string; mimeType: string }
  | { mode: "stream"; body: Buffer; fileName: string; mimeType: string };

/**
 * Authorize, then produce a download plan. Authorization ALWAYS runs before any
 * URL is minted or byte is read, so knowing a storage key grants nothing — keys
 * are never accepted as input and never returned to clients.
 *
 * Partners additionally need an active share allowing `evidence.read`; viewers
 * (published-only) may fetch APPROVED evidence exclusively.
 */
export async function prepareEvidenceDownload(actor: AccessContext, evidenceId: string): Promise<DownloadPlan> {
  const solutionId = await solutionIdForEvidence(evidenceId);
  requirePermission(actor, VIEW);
  await requireScope(actor, "INNOVATION_SOLUTION", solutionId);
  const solution = await loadSolutionCtx(solutionId);
  const mode = await resolveAccessMode(actor, solution);

  if (mode === "PARTNER") {
    await requireShareAction(actor, "INNOVATION_SOLUTION", solution.id, "evidence.read");
  }

  const evidence = await prisma.evidence.findUnique({
    where: { id: evidenceId },
    select: { id: true, fileName: true, mimeType: true, storagePath: true, reviewStatus: true },
  });
  if (!evidence) throw new EvidenceError("NOT_FOUND", "الدليل غير موجود");
  if (mode === "PUBLISHED" && evidence.reviewStatus !== "APPROVED") {
    throw new EvidenceError("NOT_FOUND", "الدليل غير متاح");
  }
  if (!evidence.storagePath) throw new EvidenceError("NO_BINARY", "لا يوجد ملف مخزّن لهذا الدليل");

  const fileName = evidence.fileName ?? "evidence";
  const mimeType = evidence.mimeType ?? "application/octet-stream";
  const storage = await getStorage();

  await writeAudit({
    actorUserId: actor.userId,
    action: AUDIT.EVIDENCE_DOWNLOADED,
    entityType: "EVIDENCE",
    entityId: evidenceId,
    departmentId: solution.owningDepartmentId,
    summary: "تنزيل ملف الدليل",
    metadata: { solutionId, accessMode: mode, fileName },
  });

  if (signedUrlsEnabled() && storage.supportsSignedUrls) {
    const url = await storage.getSignedUrl(evidence.storagePath, {
      expiresInSeconds: signedUrlTtlSeconds(),
      fileName,
    });
    if (url) return { mode: "redirect", url, fileName, mimeType };
  }

  try {
    const object = await storage.get(evidence.storagePath);
    return { mode: "stream", body: object.body, fileName, mimeType };
  } catch (e) {
    if (e instanceof StorageError && e.code === "NOT_FOUND") {
      throw new EvidenceError("NO_BINARY", "الملف غير موجود في وحدة التخزين");
    }
    throw new EvidenceError("STORAGE_FAILED", "تعذّر جلب الملف", undefined, e);
  }
}

/** Record a denied download attempt (actor + evidence + reason only). */
export async function auditDownloadDenied(actorUserId: string | null, evidenceId: string, reason: string) {
  await writeAudit({
    actorUserId,
    action: AUDIT.EVIDENCE_DOWNLOAD_DENIED,
    entityType: "EVIDENCE",
    entityId: evidenceId,
    summary: "محاولة تنزيل مرفوضة",
    metadata: { reason },
  });
}

// ── Version-safe replacement ───────────────────────────────────────────────

/**
 * Replace the binary with a NEW object under a new key and bump `version`.
 * The previous object is retained (never overwritten), and the previous
 * file metadata + checksum are preserved in the append-only audit trail.
 * APPROVED/ARCHIVED evidence can never be replaced silently.
 */
export async function replaceEvidenceFile(
  actor: AccessContext,
  evidenceId: string,
  file: EvidenceFileInput,
): Promise<{ version: number }> {
  const solutionId = await solutionIdForEvidence(evidenceId);
  requirePermission(actor, UPLOAD);
  await requireScope(actor, "INNOVATION_SOLUTION", solutionId);
  const solution = await loadSolutionCtx(solutionId);

  // Replacement is an internal custodial action — partners cannot re-file.
  const mode = await resolveAccessMode(actor, solution);
  if (mode !== "INTERNAL") throw new EvidenceError("INVALID_TRANSITION", "استبدال الملف من صلاحية الفريق الداخلي");

  const current = await prisma.evidence.findUnique({
    where: { id: evidenceId },
    select: { id: true, version: true, reviewStatus: true, storagePath: true, fileName: true, mimeType: true, sizeBytes: true, checksum: true },
  });
  if (!current) throw new EvidenceError("NOT_FOUND", "الدليل غير موجود");
  if (current.reviewStatus === "APPROVED" || current.reviewStatus === "ARCHIVED") {
    throw new EvidenceError("INVALID_TRANSITION", "لا يمكن استبدال ملف دليل معتمد أو مؤرشف");
  }

  const validated = validateFile(file);
  const nextVersion = current.version + 1;
  const key = buildEvidenceKey({ solutionId, version: nextVersion, fileName: validated.fileName });
  const storage = await getStorage();
  try {
    await storage.put(key, validated.bytes, {
      contentType: validated.mimeType,
      checksum: validated.checksum,
      fileName: validated.fileName,
    });
  } catch (e) {
    throw new EvidenceError("STORAGE_FAILED", "تعذّر تخزين الملف الجديد. لم يتغيّر الدليل.", undefined, e);
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.evidence.update({
        where: { id: evidenceId },
        data: {
          fileName: validated.fileName,
          mimeType: validated.mimeType,
          sizeBytes: validated.sizeBytes,
          checksum: validated.checksum,
          storagePath: key,
          version: nextVersion,
          fileProcessingStatus: "UPLOADED", // a new binary must be re-processed
        },
      });
      await writeAudit(
        {
          actorUserId: actor.userId,
          action: AUDIT.EVIDENCE_FILE_REPLACED,
          entityType: "EVIDENCE",
          entityId: evidenceId,
          departmentId: solution.owningDepartmentId,
          summary: "استبدال ملف الدليل",
          // Full metadata history (previous → new) lives in the audit trail.
          before: {
            version: current.version,
            fileName: current.fileName,
            mimeType: current.mimeType,
            sizeBytes: current.sizeBytes,
            checksum: current.checksum,
          },
          after: {
            version: nextVersion,
            fileName: validated.fileName,
            mimeType: validated.mimeType,
            sizeBytes: validated.sizeBytes,
            checksum: validated.checksum,
          },
          metadata: { solutionId },
        },
        tx,
      );
    });
  } catch (dbError) {
    try {
      await storage.delete(key); // roll back the new object; the original stays intact
    } catch {
      /* orphan object; retention job will reclaim it */
    }
    throw dbError;
  }

  return { version: nextVersion };
}

// ── Linking ────────────────────────────────────────────────────────────────

const TARGET_EXISTS: Record<string, (id: string) => Promise<boolean>> = {
  COMPLIANCE_REQUIREMENT: async (id) => !!(await prisma.complianceRequirement.findUnique({ where: { id }, select: { id: true } })),
  INNOVATION_SOLUTION: async (id) => !!(await prisma.innovationSolution.findUnique({ where: { id }, select: { id: true } })),
  STRATEGIC_OBJECTIVE: async (id) => !!(await prisma.strategicObjective.findUnique({ where: { id }, select: { id: true } })),
  INNOVATION_ACTIVITY: async (id) => !!(await prisma.innovationActivity.findUnique({ where: { id }, select: { id: true } })),
  IMPACT_MEASUREMENT: async (id) => !!(await prisma.impactMeasurement.findUnique({ where: { id }, select: { id: true } })),
};

/** Map evidence to another record. entityId integrity is application-enforced. */
export async function linkEvidence(actor: AccessContext, evidenceId: string, raw: unknown) {
  const solutionId = await solutionIdForEvidence(evidenceId);
  requirePermission(actor, UPLOAD);
  await requireScope(actor, "INNOVATION_SOLUTION", solutionId);
  const solution = await loadSolutionCtx(solutionId);

  const parsed = evidenceLinkSchema.safeParse(raw);
  if (!parsed.success) throw new EvidenceError("VALIDATION", "invalid", parsed.error.flatten().fieldErrors);
  const { entityType, entityId, requirementId } = parsed.data;

  const exists = await TARGET_EXISTS[entityType]?.(entityId);
  if (!exists) throw new EvidenceError("BAD_REFERENCE", "السجل المستهدف غير موجود");
  if (requirementId) {
    const req = await prisma.complianceRequirement.findUnique({ where: { id: requirementId }, select: { id: true } });
    if (!req) throw new EvidenceError("BAD_REFERENCE", "المتطلب غير موجود");
  }

  const duplicate = await prisma.evidenceLink.findUnique({
    where: { evidenceId_entityType_entityId: { evidenceId, entityType: entityType as LinkedEntityType, entityId } },
  });
  if (duplicate) throw new EvidenceError("DUPLICATE", "الربط موجود بالفعل");

  try {
    return await prisma.$transaction(async (tx) => {
      const link = await tx.evidenceLink.create({
        data: { evidenceId, entityType: entityType as LinkedEntityType, entityId, requirementId: requirementId ?? null },
        select: { id: true },
      });
      await writeAudit(
        {
          actorUserId: actor.userId,
          action: AUDIT.EVIDENCE_LINKED,
          entityType: "EVIDENCE",
          entityId: evidenceId,
          departmentId: solution.owningDepartmentId,
          summary: "ربط الدليل بسجل",
          metadata: { solutionId, linkId: link.id, targetType: entityType, targetId: entityId, requirementId: requirementId ?? null },
        },
        tx,
      );
      return link;
    });
  } catch (e) {
    if (typeof e === "object" && e && (e as { code?: string }).code === "P2002") {
      throw new EvidenceError("DUPLICATE", "الربط موجود بالفعل");
    }
    throw e;
  }
}

/** Remove a mapping. The solution link itself cannot be removed. */
export async function unlinkEvidence(actor: AccessContext, linkId: string) {
  const link = await prisma.evidenceLink.findUnique({
    where: { id: linkId },
    select: { id: true, evidenceId: true, entityType: true, entityId: true },
  });
  if (!link) throw new EvidenceError("NOT_FOUND", "الربط غير موجود");

  const solutionId = await solutionIdForEvidence(link.evidenceId);
  requirePermission(actor, UPLOAD);
  await requireScope(actor, "INNOVATION_SOLUTION", solutionId);
  const solution = await loadSolutionCtx(solutionId);

  if (link.entityType === "INNOVATION_SOLUTION" && link.entityId === solutionId) {
    throw new EvidenceError("INVALID_TRANSITION", "لا يمكن فصل الدليل عن الحل المالك");
  }

  await prisma.$transaction(async (tx) => {
    await tx.evidenceLink.delete({ where: { id: linkId } });
    await writeAudit(
      {
        actorUserId: actor.userId,
        action: AUDIT.EVIDENCE_UNLINKED,
        entityType: "EVIDENCE",
        entityId: link.evidenceId,
        departmentId: solution.owningDepartmentId,
        summary: "إلغاء ربط الدليل",
        metadata: { solutionId, targetType: link.entityType, targetId: link.entityId },
      },
      tx,
    );
  });
}

export async function listEvidenceLinks(actor: AccessContext, evidenceId: string) {
  const solutionId = await solutionIdForEvidence(evidenceId);
  await requireEvidenceRead(actor, solutionId);
  return prisma.evidenceLink.findMany({
    where: { evidenceId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true, entityType: true, entityId: true, requirementId: true, createdAt: true,
      requirement: { select: { code: true, titleAr: true } },
    },
  });
}

// ── Timeline ───────────────────────────────────────────────────────────────

/** Read-only evidence timeline from the append-only audit log. */
export async function getEvidenceTimeline(actor: AccessContext, evidenceId: string) {
  const solutionId = await solutionIdForEvidence(evidenceId);
  await requireEvidenceRead(actor, solutionId);
  return prisma.auditLog.findMany({
    where: { entityType: "EVIDENCE", entityId: evidenceId },
    orderBy: { createdAt: "desc" },
    select: { id: true, action: true, summary: true, metadata: true, createdAt: true, actor: { select: { name: true } } },
  });
}

export type EvidenceTimelineRow = Awaited<ReturnType<typeof getEvidenceTimeline>>[number];

/** UI flags — every action re-enforces server-side. */
export function computeEvidenceFlags(
  evidence: { reviewStatus: EvidenceReviewStatus; uploadedById: string | null },
  _actor: AccessContext,
  perms: { canUpload: boolean; canApprove: boolean },
) {
  return {
    // The server additionally requires the uploader or an internal in-scope user.
    canSubmit: perms.canUpload && evidence.reviewStatus === "DRAFT",
    canStartReview: perms.canApprove && evidence.reviewStatus === "SUBMITTED",
    canApprove: perms.canApprove && evidence.reviewStatus === "UNDER_REVIEW",
    canReject: perms.canApprove && evidence.reviewStatus === "UNDER_REVIEW",
    canArchive: perms.canApprove && (evidence.reviewStatus === "APPROVED" || evidence.reviewStatus === "REJECTED"),
    canLink: perms.canUpload && evidence.reviewStatus !== "ARCHIVED",
  };
}

// ── StrategyDocument evidence (additive — mirrors uploadEvidence's audit pattern exactly) ──

const STRATEGY_DOCUMENT_UPLOAD = "strategy.document.upload" as const;

export async function uploadStrategyDocumentEvidence(
  actor: AccessContext,
  documentId: string,
  raw: unknown,
  file: EvidenceFileInput,
): Promise<{ id: string }> {
  requirePermission(actor, STRATEGY_DOCUMENT_UPLOAD);
  const parsed = evidenceMetadataSchema.safeParse(raw);
  if (!parsed.success) throw new EvidenceError("VALIDATION", "invalid", parsed.error.flatten().fieldErrors);
  const validated = validateFile(file);
  const meta: EvidenceMetadataInput = parsed.data;

  const key = buildEntityEvidenceKey({ namespace: "strategy-documents", entityId: documentId, fileName: validated.fileName });
  const storage = await getStorage();
  try {
    await storage.put(key, validated.bytes, { contentType: validated.mimeType, checksum: validated.checksum, fileName: validated.fileName });
  } catch (e) {
    throw new EvidenceError("STORAGE_FAILED", "تعذّر تخزين الملف. لم يتم إنشاء أي سجل.", undefined, e);
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const created = await tx.evidence.create({
        data: {
          title: meta.title,
          notes: meta.description,
          classification: meta.classification,
          fileName: validated.fileName,
          mimeType: validated.mimeType,
          sizeBytes: validated.sizeBytes,
          checksum: validated.checksum,
          storagePath: key,
          version: 1,
          uploadedById: actor.userId,
          reviewStatus: "DRAFT",
          fileProcessingStatus: "UPLOADED",
        },
        select: { id: true },
      });
      await tx.evidenceLink.create({
        data: { evidenceId: created.id, entityType: "STRATEGY_DOCUMENT", entityId: documentId },
      });
      await writeAudit(
        {
          actorUserId: actor.userId,
          action: AUDIT.EVIDENCE_UPLOADED,
          entityType: "EVIDENCE",
          entityId: created.id,
          summary: "رفع شاهد لوثيقة استراتيجية",
          metadata: { documentId, fileName: validated.fileName, mimeType: validated.mimeType, sizeBytes: validated.sizeBytes, checksum: validated.checksum },
          after: { evidenceId: created.id },
        },
        tx,
      );
      return created;
    });
  } catch (dbError) {
    try {
      await storage.delete(key);
    } catch {
      /* orphan object; retention job will reclaim it */
    }
    throw dbError;
  }
}

/** Evidence existence check for StrategyDocument screens/rollups — batched (one query for N documents), avoiding the N+1 pattern a per-item check would cause on list/rollup screens. */
export async function documentIdsWithEvidence(documentIds: string[]): Promise<Set<string>> {
  if (documentIds.length === 0) return new Set();
  const links = await prisma.evidenceLink.findMany({
    where: { entityType: "STRATEGY_DOCUMENT", entityId: { in: documentIds } },
    select: { entityId: true },
  });
  return new Set(
    links
      .map((l: { entityId: string | null }) => l.entityId)
      .filter((id: string | null): id is string => id !== null),
  );
}
