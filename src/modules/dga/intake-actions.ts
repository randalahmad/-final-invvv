"use server";
// مسار عام بلا مصادقة — يقابل submitInviteContributionAction في
// requirement-contributions/actions.ts، لكنه لا يستدعي أي شيء من نظام
// المساهمات (بند 12: المستجيب العام ليس مساهمًا).
import { submitPublicIntakeResponse, IntakeError } from "./intake-service";

export interface PublicIntakeActionState { success?: string; error?: string; referenceNumber?: string }

export async function submitPublicIntakeAction(_previous: PublicIntakeActionState, fd: FormData): Promise<PublicIntakeActionState> {
  try {
    const file = fd.get("attachment");
    const attachment = file instanceof File && file.size > 0 ? { fileName: file.name, mimeType: file.type, bytes: Buffer.from(await file.arrayBuffer()) } : null;
    const customAnswers: Record<string, string> = {};
    for (const [key, value] of fd.entries()) if (key.startsWith("custom:") && typeof value === "string" && value.trim()) customAnswers[key.slice(7)] = value.trim();
    const result = await submitPublicIntakeResponse(String(fd.get("token") ?? ""), {
      submitterName: String(fd.get("submitterName") ?? ""),
      submitterEmail: String(fd.get("submitterEmail") ?? ""),
      submitterOrg: String(fd.get("submitterOrg") ?? ""),
      participationType: String(fd.get("participationType") ?? ""),
      title: String(fd.get("title") ?? ""),
      description: String(fd.get("description") ?? ""),
      relatedServiceName: String(fd.get("relatedServiceName") ?? ""),
      consent: String(fd.get("consent") ?? "") === "true",
      customAnswers,
      attachment,
    });
    return { success: "تم استلام إرسالك بنجاح. احتفظ بالرقم المرجعي للمتابعة.", referenceNumber: result.referenceNumber };
  } catch (error) {
    if (error instanceof IntakeError) {
      if (error.code === "NOT_FOUND") return { error: "رابط الاستقبال غير صالح." };
      if (error.code === "CLOSED") return { error: error.message };
      if (error.code === "VALIDATION") return { error: error.message };
      return { error: "تعذر إرسال الرد حاليًا. حاول لاحقًا." };
    }
    return { error: "تعذر إرسال الرد حاليًا. حاول لاحقًا." };
  }
}
