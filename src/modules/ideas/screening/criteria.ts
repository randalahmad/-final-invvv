/**
 * The rubric the AI screening provider judges a submitted idea against.
 * Kept as plain data (not hard-coded inside the provider) so the wording can
 * be tuned without touching request/response plumbing, and so a future
 * heuristic (offline, no external call) provider can reuse the exact same
 * criterion keys/labels as the AI one.
 *
 * This is deliberately a PRELIMINARY, advisory screen -- it feeds the human
 * evaluator's initial review, it is not itself the evaluation (see
 * IdeaScreeningProvider's doc comment and the invariant repeated in
 * service.ts).
 */
export interface ScreeningCriterion {
  key: string;
  labelAr: string;
  guidance: string;
}

export const SCREENING_CRITERIA: ScreeningCriterion[] = [
  {
    key: "completeness",
    labelAr: "اكتمال الوصف ووضوحه",
    guidance: "هل يشرح الوصف المشكلة والفكرة المقترحة بشكل كافٍ لبدء مراجعة فعلية، أم أنه مقتضب جدًا أو غامض؟",
  },
  {
    key: "strategic_alignment",
    labelAr: "الارتباط بالنشاط/الإدارة",
    guidance: "هل تتسق الفكرة مع النشاط الابتكاري المرتبط بها (إن وُجد) ومع اختصاص الإدارة المالكة؟",
  },
  {
    key: "feasibility_signal",
    labelAr: "مؤشر الجدوى المبدئية",
    guidance: "بناءً على الوصف فقط (دون معلومات مالية أو تقنية تفصيلية)، هل تبدو الفكرة قابلة للتنفيذ ومحددة، أم طموحة جدًا أو غير واقعية ظاهريًا؟",
  },
  {
    key: "possible_duplicate",
    labelAr: "احتمال التكرار مع أفكار سابقة",
    guidance: "قارن عنوان الفكرة ووصفها بعناوين الأفكار الأخرى غير المؤرشفة في نفس الإدارة (المرفقة أدناه) — هل تبدو مطابقة أو شديدة التشابه مع فكرة سابقة؟",
  },
  {
    key: "risk_flags",
    labelAr: "إشارات مخاطر عامة",
    guidance: "هل يتضمن الوصف أي إشارة إلى مخاطر قانونية أو تنظيمية أو خصوصية بيانات أو تكاليف غير مقدّرة تستحق تنبيه المُقيّم البشري؟",
  },
];
