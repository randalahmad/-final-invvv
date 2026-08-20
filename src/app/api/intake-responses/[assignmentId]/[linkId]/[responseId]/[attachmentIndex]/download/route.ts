import { NextResponse } from "next/server";
import { getAccessContext } from "@/server/authz";
import { getStorage } from "@/server/storage";
import { loadRequirementWorkspace } from "@/modules/dga/workspace-service";
import { findResponseAttachment, INTAKE_REQUIREMENT_ID } from "@/modules/dga/intake-service";
import type { WorkspaceData } from "@/modules/dga/workspace-status";

// نمط محمي مطابق لـ requirement-evidence/[evidenceId]/download — مصادقة +
// تحقق أن الطالب يملك مساحة عمل المتطلب 5.23.3.5 نفسها قبل أي قراءة تخزين.
// المرفق مخزَّن عبر نفس بنية الإثبات (validateFile/getStorage) بلا مستودع مكرر.
export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: { assignmentId: string; linkId: string; responseId: string; attachmentIndex: string } }) {
  const actor = await getAccessContext();
  if (!actor) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  try {
    const workspace = await loadRequirementWorkspace(actor, INTAKE_REQUIREMENT_ID);
    if (workspace.assignment.id !== params.assignmentId) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    const attachment = findResponseAttachment(workspace.assignment.workspaceData as WorkspaceData, params.linkId, params.responseId, Number(params.attachmentIndex));
    if (!attachment) return NextResponse.json({ error: "غير موجود" }, { status: 404 });
    const stored = await (await getStorage()).get(attachment.storageKey);
    return new NextResponse(new Uint8Array(stored.body), { headers: { "Content-Type": attachment.mimeType || stored.contentType || "application/octet-stream", "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(attachment.fileName || "attachment")}`, "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "تعذر تنزيل الملف" }, { status: 403 });
  }
}
