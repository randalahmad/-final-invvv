"use server";
import { revalidatePath } from "next/cache";
import { getAccessContext } from "@/server/authz";
import { saveImpactEntry } from "./service";

export interface ImpactActionState { error?: string; success?: string }
export async function saveImpactAction(_: ImpactActionState, formData: FormData): Promise<ImpactActionState> {
  try {
    const actor = await getAccessContext();
    if (!actor) return { error: "يلزم تسجيل الدخول" };
    await saveImpactEntry(actor, {
      solutionId: formData.get("solutionId"), indicatorId: formData.get("indicatorId") || undefined,
      nameAr: formData.get("nameAr"), type: formData.get("type"), unit: formData.get("unit") || null,
      baselineValue: formData.get("baselineValue"), targetValue: formData.get("targetValue"), measurementMethod: formData.get("measurementMethod") || null,
      actualValue: formData.get("actualValue"), periodStart: formData.get("periodStart") || null, periodEnd: formData.get("periodEnd") || null,
      dataSource: formData.get("dataSource") || null, notes: formData.get("notes") || null,
    });
    revalidatePath(`/impact/${formData.get("solutionId")}`); revalidatePath("/impact"); revalidatePath("/dashboard"); revalidatePath("/compliance");
    return { success: "تم حفظ المؤشر والقياس" };
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_PERIOD") return { error: "نهاية الفترة يجب أن تكون بعد بدايتها" };
    if (error instanceof Error && error.message.startsWith("NOT_ELIGIBLE_FOR_MEASUREMENT:")) return { error: `الحل غير مؤهل رسميًا لقياس الأثر بعد وفق معيار 5.24.1: ${error.message.replace("NOT_ELIGIBLE_FOR_MEASUREMENT: ", "")}` };
    return { error: "تعذر حفظ القياس" };
  }
}
