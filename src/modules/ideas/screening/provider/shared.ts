import { z } from "zod";

import { SCREENING_CRITERIA } from "../criteria";
import type { IdeaScreeningContext } from "./types";

/**
 * Prompt + output-schema shared by every idea-screening provider
 * implementation (Gateway, direct Anthropic, future providers). Keeping one
 * copy avoids the prompt/schema drifting between providers.
 */

export const findingSchema = z.object({
  criterionKey: z.string(),
  labelAr: z.string(),
  verdict: z.enum(["STRONG", "ACCEPTABLE", "WEAK", "CONCERN"]),
  noteAr: z.string().optional(),
});

export const outputSchema = z.object({
  score: z.number().int().min(0).max(100),
  recommendation: z.enum(["PROCEED", "NEEDS_INFO", "REJECT"]),
  summaryAr: z.string().min(1),
  findings: z.array(findingSchema).min(1),
});

export const SCREENING_SYSTEM_PROMPT =
  "أنت مساعد فحص مبدئي لمنصة إدارة الابتكار المؤسسي. دورك استشاري بحت: تقترح ملاحظات أولية لموظف بشري سيراجع الفكرة فعليًا، ولا تملك أي صلاحية قبول أو رفض نهائي لها.";

export function buildPrompt(context: IdeaScreeningContext): string {
  const criteriaList = SCREENING_CRITERIA.map((c) => `- ${c.key} (${c.labelAr}): ${c.guidance}`).join("\n");
  const siblings = context.siblingIdeaTitles.length
    ? context.siblingIdeaTitles.map((t) => `- ${t}`).join("\n")
    : "(لا توجد أفكار أخرى مسجّلة لهذه الإدارة حاليًا)";

  return `قيّم الفكرة التالية وفق هذه المعايير حصرًا:
${criteriaList}

بيانات الفكرة:
العنوان: ${context.idea.titleAr}
الوصف: ${context.idea.description?.trim() || "(لا يوجد وصف)"}
الإدارة المالكة: ${context.department?.nameAr ?? "غير محددة"}
النشاط المرتبط: ${context.activity ? `${context.activity.nameAr} (${context.activity.type})` : "لا يوجد"}

عناوين أفكار أخرى في نفس الإدارة (لفحص التكرار فقط):
${siblings}

أعد ردًا بصيغة JSON صِرف فقط (بدون أي نص قبله أو بعده) مطابقًا تمامًا لهذا الشكل:
{
  "score": <رقم صحيح من 0 إلى 100>,
  "recommendation": "PROCEED" | "NEEDS_INFO" | "REJECT",
  "summaryAr": "<ملخص من جملتين إلى ثلاث بالعربية>",
  "findings": [
    { "criterionKey": "<أحد المفاتيح أعلاه>", "labelAr": "<التسمية العربية>", "verdict": "STRONG" | "ACCEPTABLE" | "WEAK" | "CONCERN", "noteAr": "<ملاحظة قصيرة اختيارية>" }
  ]
}
قدّم بندًا واحدًا على الأقل في "findings" لكل معيار من المعايير الخمسة أعلاه.`;
}
