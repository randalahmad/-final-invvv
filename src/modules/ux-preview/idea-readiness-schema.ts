import { z } from "zod";

export const ideaReadinessSchema = z.object({
  title: z.string().describe("عنوان عربي موجز للفكرة أو المشروع"),
  problem: z.string().describe("المشكلة أو الفرصة كما يدعمها المستند"),
  beneficiaries: z.string().describe("المستفيدون المستهدفون، أو غير مذكور"),
  proposedSolution: z.string().describe("الحل المقترح كما يدعمه المستند"),
  department: z.string().describe("الإدارة أو الجهة المالكة، أو غير محددة"),
  strategicAlignment: z.string().describe("الارتباط بالأهداف المؤسسية، أو غير مذكور"),
  score: z.number().min(0).max(100).describe("تقدير اكتمال العرض وليس قرار قبول"),
  level: z.enum(["غير مكتمل", "يحتاج استكمال", "جاهز للمراجعة الأولية"]),
  strengths: z.array(z.string()).max(5),
  gaps: z.array(z.string()).max(6),
  missingFields: z.array(z.string()).max(8),
  recommendation: z.string().describe("إجراء تحضيري تالٍ لا يتضمن قرار قبول أو رفض"),
});

export type IdeaReadinessResult = z.infer<typeof ideaReadinessSchema>;
