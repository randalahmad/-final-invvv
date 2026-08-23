import { createHash, randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import type { AccessContext } from "@/server/access-context";
import { requirePermission } from "@/server/authorization";
import { solutionFingerprint } from "./portfolio";
import { AUDIT, writeAudit } from "@/server/audit";

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createSolutionIntakeLink(actor: AccessContext, input: { nameAr: string; purpose: string; targetDepartmentId?: string; startsAt?: Date; closesAt?: Date; instructions?: string }) {
  requirePermission(actor, "solution.create");
  if (!input.nameAr.trim() || !input.purpose.trim()) throw new Error("VALIDATION");
  const token = randomBytes(24).toString("base64url");
  const row = await prisma.solutionIntakeLink.create({ data: { tokenHash: hash(token), tokenLast4: token.slice(-4), nameAr: input.nameAr.trim(), purpose: input.purpose.trim(), targetDepartmentId: input.targetDepartmentId || null, ownerUserId: actor.userId, startsAt: input.startsAt ?? new Date(), closesAt: input.closesAt ?? null, instructions: input.instructions?.trim() || null } });
  await writeAudit({ actorUserId: actor.userId, action: AUDIT.SOLUTION_INTAKE_LINK_CREATED, entityId: row.id, summary: `إنشاء رابط حصر حلول: ${row.nameAr}` });
  return { ...row, token };
}

export async function listSolutionIntakeLinks(actor: AccessContext) {
  requirePermission(actor, "solution.view");
  return prisma.solutionIntakeLink.findMany({ where: { archivedAt: null }, include: { _count: { select: { submissions: true } } }, orderBy: { createdAt: "desc" } });
}

export async function getPublicSolutionIntake(token: string) {
  const row = await prisma.solutionIntakeLink.findUnique({ where: { tokenHash: hash(token) }, select: { id: true, nameAr: true, purpose: true, instructions: true, startsAt: true, closesAt: true, isActive: true } });
  if (!row || !row.isActive || row.startsAt > new Date() || (row.closesAt && row.closesAt < new Date())) return null;
  return row;
}

export async function submitPublicSolutionIntake(token: string, payload: Record<string, unknown>) {
  const link = await getPublicSolutionIntake(token); if (!link) throw new Error("LINK_INACTIVE");
  const nameAr = String(payload.nameAr ?? "").trim(); const submitterName = String(payload.submitterName ?? "").trim();
  if (nameAr.length < 3 || submitterName.length < 2) throw new Error("VALIDATION");
  const fingerprint = solutionFingerprint({ nameAr, externalReferenceId: String(payload.externalReferenceId ?? "") || null });
  const duplicate = await prisma.innovationSolution.findFirst({ where: { OR: [{ intakeFingerprint: fingerprint }, { nameAr: { equals: nameAr, mode: "insensitive" } }] }, select: { id: true } });
  const row = await prisma.solutionIntakeSubmission.create({ data: { intakeLinkId: link.id, sourceKind: "SCOPED_LINK", submitterName, submitterEmail: String(payload.submitterEmail ?? "") || null, departmentName: String(payload.departmentName ?? "") || null, payload: payload as Prisma.InputJsonValue, fingerprint, status: duplicate ? "POSSIBLE_DUPLICATE" : "SUBMITTED", duplicateReason: duplicate ? "تطابق حتمي في العنوان أو المعرّف المرجعي" : null, linkedSolutionId: duplicate?.id ?? null } });
  await writeAudit({ action: duplicate ? AUDIT.SOLUTION_DUPLICATE_FLAGGED : AUDIT.SOLUTION_INTAKE_SUBMITTED, entityId: row.id, summary: duplicate ? "استلام حل مع تنبيه تكرار حتمي" : "استلام حل عبر رابط الحصر", metadata: { intakeLinkId: link.id } });
  return row;
}

export function parseCsvPreview(csv: string) {
  const lines=csv.replace(/^\uFEFF/,"").split(/\r?\n/).filter(Boolean); if(!lines.length)return {headers:[],rows:[],issues:["الملف فارغ"]};
  const split=(line:string)=>line.split(",").map(x=>x.trim().replace(/^"|"$/g,"")); const headers=split(lines[0]);
  const rows=lines.slice(1,51).map((line,index)=>{const values=split(line);const record=Object.fromEntries(headers.map((h,i)=>[h,values[i]??""]));return {row:index+2,record,valid:Boolean(record["اسم الحل"]||record["Solution Name"]),issue:(record["اسم الحل"]||record["Solution Name"])?null:"اسم الحل مفقود"};});
  return {headers,rows,issues:rows.filter(x=>!x.valid).map(x=>`الصف ${x.row}: ${x.issue}`)};
}
