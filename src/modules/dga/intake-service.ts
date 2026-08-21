import { randomBytes } from "crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { writeAudit, AUDIT } from "@/server/audit";
import { buildEntityEvidenceKey, getStorage } from "@/server/storage";
import { validateFile, type EvidenceFileInput } from "@/modules/evidence/service";
import { deriveOperationalStatus, type WorkspaceData } from "./workspace-status";
import { getWorkspaceConfig, isIntakeLinkAcceptingResponses } from "./workspace-config";

// 5.23.3 Requirement 05 — استقبال المقترحات والتغذية الراجعة. هذا الملف هو
// المسار العام الوحيد في المنصة الذي يكتب إلى workspaceData بلا مستخدم منصة
// (لا requireUser()/getAccessContext()) — يقابل نمط src/modules/requirement-
// contributions/service.ts (contributionForToken/submitContributionByToken)
// لكنه آلية منفصلة تمامًا: المستجيب العام ليس مساهمًا (بند 12/21 من المواصفة).
// روابط الاستقبال JSON-only داخل workspaceData["intakeLinks"] لمهمة 5.23.3.5
// فقط — لا جدول Prisma جديد؛ البحث عن التوكن يفحص صفوف الإسناد لهذا المتطلب
// فقط (حجم صغير في منصة حوكمة داخلية، وليس نطاقًا عامًا واسع الحجم).
export const INTAKE_REQUIREMENT_ID = "5-23-3-r5";
export const INTAKE_REQUIREMENT_CODE = "5.23.3.5";

export class IntakeError extends Error {
  constructor(public code: "NOT_FOUND" | "CLOSED" | "VALIDATION" | "STORAGE_FAILED", message?: string) {
    super(message ?? code);
  }
}

type Row = Record<string, unknown>;
const arr = (value: unknown) => (Array.isArray(value) ? (value as Row[]) : []);

export function newReferenceNumber(): string {
  return `FB-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

/** يبحث عن رابط الاستقبال المطابق للتوكن ضمن كل إسنادات المتطلب 5.23.3.5 — بلا فهرس Prisma مخصص، مقبول لحجم منصة حوكمة داخلية. */
async function findAssignmentWithLink(token: string) {
  const rows = await prisma.complianceRequirementAssignment.findMany({ where: { archivedAt: null, requirement: { code: INTAKE_REQUIREMENT_CODE } } });
  for (const assignment of rows) {
    const data = assignment.workspaceData as WorkspaceData;
    const link = arr(data.intakeLinks).find((row) => String(row.token ?? "") === token);
    if (link) return { assignment, link };
  }
  return null;
}

/** لقطة آمنة للعرض العام — عنوان/غرض/حقول/إرسال فقط، بلا أي بيانات داخلية أو ردود سابقة (بند 5/18: التوكن العام للإرسال فقط، لا قراءة). */
export async function getPublicIntake(token: string) {
  const found = await findAssignmentWithLink(token);
  if (!found) throw new IntakeError("NOT_FOUND");
  const { link } = found;
  if (!isIntakeLinkAcceptingResponses(link)) throw new IntakeError("CLOSED", "هذا الرابط غير متاح لاستقبال ردود جديدة حاليًا.");
  return {
    token,
    name: String(link.name ?? ""),
    purpose: String(link.purpose ?? ""),
    type: String(link.type ?? ""),
    participantDescription: String(link.participantDescription ?? ""),
    instructions: String(link.instructions ?? ""),
    relatedServiceName: String(link.relatedServiceName ?? "") || null,
    fields: arr(link.formFields).filter((field) => field.enabled !== false).map((field) => ({ key: String(field.key ?? ""), label: String(field.label ?? ""), required: Boolean(field.required), enabled: field.enabled !== false })),
  };
}

export interface PublicIntakeSubmission {
  submitterName?: string;
  submitterEmail?: string;
  submitterOrg?: string;
  participationType?: string;
  title: string;
  description: string;
  relatedServiceName?: string;
  consent?: boolean;
  customAnswers?: Record<string, string>;
  attachment?: EvidenceFileInput | null;
}

async function approvedEvidenceCounts(assignmentId: string, complianceRequirementId: string) {
  const links = await prisma.evidenceLink.findMany({ where: { entityType: "REQUIREMENT_ASSIGNMENT", entityId: assignmentId, requirementId: complianceRequirementId, evidence: { archivedAt: null, reviewStatus: "APPROVED" } }, include: { evidence: true } });
  const counts: Record<string, number> = {};
  links.forEach(({ evidence }) => { if (evidence.classification) counts[evidence.classification] = (counts[evidence.classification] ?? 0) + 1; });
  return counts;
}

/** الاستقبال العام الوحيد بلا مستخدم منصة — يكتب إلى نفس workspaceData الذي تقرأه مساحة العمل الإدارية، بلا writeAudit.actorUserId (نمط مدعوم فعليًا، راجع openContributionByToken). */
export async function submitPublicIntakeResponse(token: string, submission: PublicIntakeSubmission) {
  const found = await findAssignmentWithLink(token);
  if (!found) throw new IntakeError("NOT_FOUND");
  const { assignment, link } = found;
  if (!isIntakeLinkAcceptingResponses(link)) throw new IntakeError("CLOSED", "هذا الرابط غير متاح لاستقبال ردود جديدة حاليًا.");
  const title = submission.title.trim();
  const description = submission.description.trim();
  if (!title || !description) throw new IntakeError("VALIDATION", "عنوان المقترح ووصفه مطلوبان.");
  const requiredConsent = arr(link.formFields).some((field) => field.key === "consent" && field.enabled !== false && field.required === true);
  if (requiredConsent && !submission.consent) throw new IntakeError("VALIDATION", "يلزم تأكيد الموافقة قبل الإرسال.");

  const responseId = `intake-response-${Date.now().toString(36)}-${randomBytes(4).toString("hex")}`;
  const attachments: Row[] = [];
  if (submission.attachment) {
    let validated;
    try { validated = validateFile(submission.attachment); } catch { throw new IntakeError("VALIDATION", "تعذر قبول المرفق — تحقق من نوع الملف وحجمه (PDF أو DOCX أو XLSX)."); }
    const storageKey = buildEntityEvidenceKey({ namespace: "intake-responses", entityId: responseId, fileName: validated.fileName });
    try {
      const storage = await getStorage();
      await storage.put(storageKey, validated.bytes, { contentType: validated.mimeType, checksum: validated.checksum, fileName: validated.fileName });
    } catch { throw new IntakeError("STORAGE_FAILED", "تعذر حفظ المرفق."); }
    attachments.push({ fileName: validated.fileName, mimeType: validated.mimeType, size: validated.sizeBytes, storageKey });
  }

  const referenceNumber = newReferenceNumber();
  const anonymous = !submission.submitterName?.trim() && !submission.submitterEmail?.trim();
  const response: Row = {
    id: responseId,
    referenceNumber,
    receivedAt: new Date().toISOString(),
    type: submission.participationType?.trim() || String(link.type ?? ""),
    title,
    description,
    submitterName: submission.submitterName?.trim() || null,
    submitterEmail: submission.submitterEmail?.trim() || null,
    submitterOrg: submission.submitterOrg?.trim() || null,
    anonymous,
    relatedServiceName: submission.relatedServiceName?.trim() || String(link.relatedServiceName ?? "") || null,
    customAnswers: submission.customAnswers ?? {},
    attachments,
    status: "جديد",
    ownerUserId: null,
    notes: "",
    tasks: [],
    history: [{ date: new Date().toISOString(), action: "استلام الرد عبر رابط الاستقبال" }],
  };

  const data = assignment.workspaceData as WorkspaceData;
  const links = arr(data.intakeLinks);
  const nextLinks = links.map((row) => (row.id === link.id ? { ...row, responses: [...arr(row.responses), response] } : row));
  const nextData: WorkspaceData = { ...data, intakeLinks: nextLinks };
  const config = getWorkspaceConfig(INTAKE_REQUIREMENT_ID)!;
  const approvedCounts = await approvedEvidenceCounts(assignment.id, assignment.complianceRequirementId);
  const status = deriveOperationalStatus(config, nextData, approvedCounts);

  await prisma.$transaction(async (tx) => {
    await tx.complianceRequirementAssignment.update({ where: { id: assignment.id }, data: { workspaceData: nextData as Prisma.InputJsonValue, operationalStatus: status } });
    await writeAudit({ action: AUDIT.INTAKE_RESPONSE_RECEIVED, entityType: "COMPLIANCE_REQUIREMENT", entityId: assignment.complianceRequirementId, departmentId: assignment.departmentId, summary: `استلام رد عبر رابط الاستقبال «${String(link.name ?? "")}»`, metadata: { requirementCode: INTAKE_REQUIREMENT_CODE, linkId: String(link.id ?? ""), responseId, referenceNumber } }, tx);
  });

  return { referenceNumber, responseId };
}

/** يُستخدم من مسار تنزيل المرفق المحمي فقط — بعد تحقق مصادقة/نطاق الطالب في المسار نفسه (نمط requirement-evidence/[evidenceId]/download). */
export function findResponseAttachment(data: WorkspaceData, linkId: string, responseId: string, attachmentIndex: number) {
  const link = arr(data.intakeLinks).find((row) => row.id === linkId);
  const response = arr(link?.responses).find((row) => row.id === responseId);
  const attachment = response ? arr(response.attachments)[attachmentIndex] : undefined;
  if (!attachment) return null;
  return attachment as unknown as { fileName: string; mimeType: string; size: number; storageKey: string };
}
