"use server";

import { revalidatePath } from "next/cache";
import { getAccessContext } from "@/server/authz";
import { isAuthorizationError } from "@/server/authorization";
import { IdeaAnalysisError, runIdeaAnalysis } from "./service";

export interface IdeaAnalysisActionState { error?: string; success?: string; }

export async function runIdeaAnalysisAction(_previous: IdeaAnalysisActionState, formData: FormData): Promise<IdeaAnalysisActionState> {
  const actor = await getAccessContext();
  if (!actor) return { error: "غير مصرّح" };
  const ideaId = String(formData.get("ideaId") ?? "");
  try {
    const result = await runIdeaAnalysis(actor, ideaId);
    revalidatePath(`/governance/ideas/${ideaId}`);
    return { success: `تم إنشاء اقتراح أولي بدرجة ${result.score}/100` };
  } catch (error) {
    if (error instanceof IdeaAnalysisError && error.code === "SELF_EVALUATION") return { error: "لا يمكن لصاحب الفكرة طلب تحليل لفكرته" };
    if (isAuthorizationError(error)) return { error: "لا تملك صلاحية التقييم لهذه الفكرة" };
    throw error;
  }
}
