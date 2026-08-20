import type { WorkspaceData } from "./workspace-status";

// 5.23.3 Requirement 04 — تطوير آلية إدارة الابتكار الرقمي. تُظهر هذه
// المعاينة إصدارين لتوضيح الاحتفاظ بتاريخ الاعتماد (بند 10): إصدار أول
// مُستبدَل (1.0) وإصدار حالي معتمد (2.0) بسبع مراحل. اللجان المشار إليها في
// بوابات القرار هي نفس معرّفات preview-committee-fixture.ts (لا لجان جديدة)،
// والعملية المرتبطة بمرحلة "التطوير" هي نفس عملية preview-governance-
// operations-fixture.ts، والمبادرة في المسار المرجعي هي نفس مبادرة
// preview-workspace-fixtures.ts["5-23-1-r2"] — بلا أي تكرار لبيانات مؤسسية.
const INNOVATION_COMMITTEE_ID = "preview-committee-innovation";
const TECHNICAL_COMMITTEE_ID = "preview-committee-technical";
const LINKED_PROCESS = "مراجعة واعتماد مبادرات الابتكار";
const LINKED_INITIATIVE = "مختبر تحسين رحلة المستفيد";

function stage(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    description: "",
    entryCriteria: "",
    activities: "",
    supportingDepartments: "",
    requiredInputs: "",
    expectedOutputs: "",
    slaDuration: "",
    governanceProcessName: "",
    evidenceNotes: "",
    archived: false,
    templates: [],
    tasks: [],
    gate: { owner: "", committees: [], requiredInputs: "", outcome: "", notes: "" },
    ...overrides,
  };
}

export const PREVIEW_DIGITAL_INNOVATION_MECHANISM: WorkspaceData = {
  mechanismVersions: [
    {
      id: "preview-mechanism-v1",
      name: "آلية إدارة الابتكار الرقمي المؤسسية",
      description: "النسخة الأولى من الآلية، اعتمدت أربع مراحل مبسّطة قبل توسعتها إلى خارطة رحلة كاملة.",
      owner: "مدير إدارة الابتكار والتحول الرقمي",
      version: "1.0",
      createdDate: "2025-11-01",
      effectiveDate: "2025-12-01",
      approvalStatus: "تم الاستبدال",
      approvingAuthority: "لجنة الابتكار المؤسسي",
      nextReviewDate: "",
      stages: [
        stage({ id: "preview-stage-v1-idea", name: "فكرة", owner: "منسقة وحدة الابتكار", responsibleRole: "استقبال الفكرة الأولية", objective: "استقبال الأفكار المقترحة وتوثيقها." }),
        stage({ id: "preview-stage-v1-design", name: "تصميم", owner: "منسقة وحدة الابتكار", responsibleRole: "تصميم الحل الأولي", objective: "بلورة الفكرة إلى تصميم أولي قابل للتقييم." }),
        stage({ id: "preview-stage-v1-development", name: "تطوير", owner: "إدارة الابتكار والتحول الرقمي", responsibleRole: "تطوير النموذج الأولي", objective: "تطوير نموذج أولي للحل." }),
        stage({ id: "preview-stage-v1-implementation", name: "تنفيذ", owner: "إدارة الابتكار والتحول الرقمي", responsibleRole: "تنفيذ الحل ومتابعته", objective: "تنفيذ الحل ومتابعة نتائجه." }),
      ],
      trace: [],
      log: [
        { date: "2025-12-01T09:00:00.000Z", action: "اعتماد الإصدار 1.0 من آلية إدارة الابتكار الرقمي" },
        { date: "2026-03-10T09:00:00.000Z", action: "استُبدل هذا الإصدار بالإصدار 2.0 بعد اعتماده" },
      ],
    },
    {
      id: "preview-mechanism-v2",
      name: "آلية إدارة الابتكار الرقمي المؤسسية",
      description: "خارطة رحلة موسّعة تغطي المسار الكامل من الفكرة إلى المتابعة، مع بوابات قرار ومسؤوليات ونماذج معتمدة لكل مرحلة.",
      owner: "مدير إدارة الابتكار والتحول الرقمي",
      version: "2.0",
      createdDate: "2026-02-20",
      effectiveDate: "2026-03-10",
      approvalStatus: "معتمد",
      approvingAuthority: "لجنة الابتكار المؤسسي",
      nextReviewDate: "2027-03-10",
      stages: [
        stage({
          id: "preview-stage-idea", name: "فكرة", owner: "منسقة وحدة الابتكار", responsibleRole: "استقبال الفكرة وتوثيقها الأولي",
          objective: "استقبال الأفكار المقترحة من الموظفين والمستفيدين وتوثيقها بصيغة موحّدة.",
          entryCriteria: "تعبئة نموذج استقبال الفكرة بالحد الأدنى من البيانات.",
          activities: "تسجيل الفكرة، فرز أولي، تصنيفها ضمن مجالات الابتكار.",
          supportingDepartments: "إدارة تجربة المستفيد",
          requiredInputs: "نموذج استقبال الفكرة",
          expectedOutputs: "سجل فكرة موثّق بحالة أولية",
          templates: [{ id: "preview-template-idea-form", title: "نموذج استقبال فكرة", category: "نموذج", fileName: "idea-intake-form.pdf", reviewState: "معتمد", markedAsEvidence: "لا" }],
          gate: { owner: "منسقة وحدة الابتكار", committees: [], requiredInputs: "سجل الفكرة موثّقًا بالكامل", outcome: "اعتماد الانتقال للدراسة", notes: "فرز أولي دون الحاجة لاجتماع لجنة." },
        }),
        stage({
          id: "preview-stage-study", name: "دراسة", owner: "منسقة وحدة الابتكار", responsibleRole: "دراسة الجدوى الأولية",
          objective: "تقييم جدوى الفكرة من الناحية الفنية والمؤسسية قبل التصميم.",
          entryCriteria: "فكرة معتمدة من مرحلة الاستقبال.",
          activities: "دراسة جدوى أولية، مقارنة ببدائل قائمة، تقدير الموارد.",
          supportingDepartments: "إدارة الاستراتيجية والتخطيط",
          requiredInputs: "سجل الفكرة، بيانات مرجعية عن مبادرات مشابهة",
          expectedOutputs: "تقرير دراسة جدوى أولية",
          gate: { owner: "منسقة وحدة الابتكار", committees: [TECHNICAL_COMMITTEE_ID], requiredInputs: "تقرير دراسة الجدوى الأولية", outcome: "اعتماد الانتقال للتصميم", notes: "" },
        }),
        stage({
          id: "preview-stage-design", name: "تصميم", owner: "إدارة الابتكار والتحول الرقمي", responsibleRole: "تصميم الحل والتجربة",
          objective: "بلورة الفكرة إلى تصميم تفصيلي للحل وتجربة المستخدم.",
          entryCriteria: "دراسة جدوى معتمدة من اللجنة التقنية.",
          activities: "تصميم رحلة المستخدم، تحديد المتطلبات الوظيفية، مراجعة تصميمية.",
          supportingDepartments: "إدارة تجربة المستفيد، تقنية المعلومات",
          requiredInputs: "تقرير دراسة الجدوى",
          expectedOutputs: "وثيقة تصميم معتمدة",
          templates: [{ id: "preview-template-design-checklist", title: "قائمة تحقق مراجعة التصميم", category: "checklist", fileName: "design-review-checklist.pdf", reviewState: "معتمد", markedAsEvidence: "لا" }],
          gate: { owner: "مدير إدارة الابتكار والتحول الرقمي", committees: [TECHNICAL_COMMITTEE_ID], requiredInputs: "وثيقة التصميم المعتمدة", outcome: "اعتماد الانتقال للتطوير", notes: "" },
        }),
        stage({
          id: "preview-stage-development", name: "تطوير", owner: "إدارة الابتكار والتحول الرقمي", responsibleRole: "تطوير النموذج الأولي",
          objective: "تطوير نموذج أولي (Prototype) قابل للاختبار استنادًا إلى التصميم المعتمد.",
          entryCriteria: "وثيقة تصميم معتمدة من اللجنة التقنية.",
          activities: "تطوير النموذج الأولي، مراجعات تطوير دورية.",
          supportingDepartments: "تقنية المعلومات",
          requiredInputs: "وثيقة التصميم المعتمدة",
          expectedOutputs: "نموذج أولي قابل للاختبار",
          governanceProcessName: LINKED_PROCESS,
          templates: [{ id: "preview-template-dev-guide", title: "دليل توثيق التطوير", category: "دليل", fileName: "development-log-guide.pdf", reviewState: "قيد المراجعة", markedAsEvidence: "لا" }],
          tasks: [{ id: "preview-task-doc-development", title: "توثيق مرحلة التطوير", description: "استكمال توثيق خطوات تطوير النموذج الأولي ونتائج المراجعات الدورية.", assignedUserId: "internal", assignee: "خالد القحطاني", priority: "MEDIUM", assignedAt: "2026-08-18", dueDate: "2026-08-27", status: "IN_PROGRESS", nextAction: "فتح مساحة المرحلة واستكمال التوثيق" }],
          gate: { owner: "مدير إدارة الابتكار والتحول الرقمي", committees: [INNOVATION_COMMITTEE_ID, TECHNICAL_COMMITTEE_ID], requiredInputs: "نتائج اختبار النموذج الأولي", outcome: "اعتماد الانتقال للاختبار", notes: "يُعاد للتصميم عند فشل الاختبار الأولي." },
        }),
        stage({
          id: "preview-stage-testing", name: "اختبار", owner: "اللجنة التقنية", responsibleRole: "اختبار النموذج الأولي",
          objective: "التحقق من جاهزية الحل فنيًا وتشغيليًا قبل التنفيذ.",
          entryCriteria: "نموذج أولي مكتمل.",
          activities: "اختبار وظيفي، اختبار تجربة مستخدم محدود.",
          supportingDepartments: "تقنية المعلومات، إدارة الجودة",
          requiredInputs: "النموذج الأولي",
          expectedOutputs: "تقرير نتائج الاختبار",
          gate: { owner: "اللجنة التقنية", committees: [TECHNICAL_COMMITTEE_ID], requiredInputs: "تقرير نتائج الاختبار", outcome: "اعتماد الانتقال للتنفيذ", notes: "" },
        }),
        stage({
          id: "preview-stage-implementation", name: "تنفيذ", owner: "إدارة الابتكار والتحول الرقمي", responsibleRole: "تنفيذ الحل وإطلاقه",
          objective: "تنفيذ الحل وإطلاقه ضمن نطاق محدود أو كامل.",
          entryCriteria: "تقرير اختبار ناجح.",
          activities: "خطة إطلاق، تدريب المستخدمين، إطلاق تجريبي محدود.",
          supportingDepartments: "الإدارة صاحبة المبادرة",
          requiredInputs: "خطة الإطلاق المعتمدة",
          expectedOutputs: "حل منفَّذ وقيد التشغيل",
          gate: { owner: "لجنة الابتكار المؤسسي", committees: [INNOVATION_COMMITTEE_ID], requiredInputs: "تقرير الإطلاق الأولي", outcome: "اعتماد الانتقال للمتابعة", notes: "" },
        }),
        stage({
          id: "preview-stage-follow-up", name: "متابعة", owner: "منسقة وحدة الابتكار", responsibleRole: "متابعة الأثر والاستدامة",
          objective: "متابعة أداء الحل بعد التنفيذ وقياس أثره واستدامته.",
          entryCriteria: "حل منفَّذ فعليًا.",
          activities: "قياس مؤشرات الأداء، جمع ملاحظات المستفيدين.",
          supportingDepartments: "إدارة تجربة المستفيد",
          requiredInputs: "بيانات الاستخدام الفعلي",
          expectedOutputs: "تقرير متابعة أثر دوري",
        }),
      ],
      trace: [{ id: "preview-trace-1", initiativeId: LINKED_INITIATIVE, initiativeName: LINKED_INITIATIVE, stageId: "preview-stage-development", stageName: "تطوير", updatedDate: "2026-08-18" }],
      log: [
        { date: "2026-03-10T09:00:00.000Z", action: "اعتماد الإصدار 2.0 بخارطة رحلة موسّعة إلى سبع مراحل" },
        { date: "2026-08-18T08:00:00.000Z", action: "إسناد مهمة توثيق مرحلة التطوير" },
      ],
    },
  ],
};

export function digitalInnovationMechanismForPersona(persona?: string): WorkspaceData {
  const copy = structuredClone(PREVIEW_DIGITAL_INNOVATION_MECHANISM);
  const versions = (copy.mechanismVersions as Record<string, unknown>[]) ?? [];
  if (persona === "partner" || persona === "viewer") {
    copy.mechanismVersions = versions.map((version) => ({
      ...version,
      log: [],
      stages: (Array.isArray(version.stages) ? (version.stages as Record<string, unknown>[]) : []).map((s) => ({ ...s, tasks: [] })),
    }));
  }
  return copy;
}
