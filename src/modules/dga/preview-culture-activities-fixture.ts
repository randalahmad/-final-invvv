import type { WorkspaceData } from "./workspace-status";

// 5.23.3 Requirement 03 — نشر ثقافة الابتكار.
// النشاط الأول أدناه مرتبط بـ annualPlanActivityId="activity-workshop-2026"
// وهو نفس معرّف نشاط "ورشة الابتكار المؤسسي" في preview-annual-plan-fixture.ts
// (5.23.2.1) — إثبات أن الربط يعيد استخدام نشاط الخطة السنوية القائم فعليًا
// دون إنشاء نشاط مكرر أو نظام فعاليات موازٍ.
export const PREVIEW_CULTURE_ACTIVITIES: WorkspaceData = {
  cultureActivities: [
    {
      id: "culture-workshop-training",
      name: "ورشة تدريبية: أساسيات التفكير الابتكاري",
      cultureType: "ورشة تدريبية",
      awarenessGoal: "تمكين موظفي الإدارات التشغيلية من أدوات التفكير الابتكاري الأساسية وتطبيقها على تحديات العمل اليومية.",
      targetSegment: "موظفو الإدارات التشغيلية",
      department: "إدارة التواصل الداخلي",
      startDate: "2026-06-10",
      endDate: "2026-06-10",
      status: "مكتملة",
      knowledgeTopic: "التفكير التصميمي والعصف الذهني",
      presenter: "د. منى الزهراني",
      outcomeDescription: "أظهر استبيان ما بعد الورشة أن 90% من الحضور أصبحوا قادرين على تطبيق خطوات التفكير التصميمي على تحدٍ حقيقي من عملهم.",
      annualPlanActivityId: "activity-workshop-2026",
      annualPlanActivityName: "ورشة الابتكار المؤسسي",
      milestones: [{ id: "m1", title: "اعتماد المحتوى التدريبي", date: "2026-05-20", owner: "د. منى الزهراني", status: "مكتملة" }, { id: "m2", title: "تنفيذ الورشة", date: "2026-06-10", owner: "نورة العتيبي", status: "مكتملة" }],
      team: [{ id: "t1", name: "نورة العتيبي", department: "إدارة التواصل الداخلي", role: "منسقة الورشة", responsibilities: "التنظيم والتنسيق مع المدربة" }, { id: "t2", name: "خالد القحطاني", department: "إدارة الاتصال", role: "مسؤول التصميم", responsibilities: "تصميم الإعلان والمواد" }],
      tasks: [
        { id: "task1", title: "تجهيز المحتوى", description: "إعداد الحقيبة التدريبية بالتنسيق مع المدربة", assignedUserId: "internal", assignee: "محرر الابتكار الداخلي", priority: "HIGH", assignedAt: "2026-05-15", dueDate: "2026-05-25", status: "COMPLETED", completedAt: "2026-05-24T09:00:00.000Z", nextAction: "مراجعة الحقيبة قبل الطباعة" },
        { id: "task2", title: "تصميم الإعلان", description: "تصميم بوستر الورشة ونشره", assignedUserId: "admin", assignee: "مدير النظام", priority: "MEDIUM", assignedAt: "2026-05-18", dueDate: "2026-05-28", status: "COMPLETED", completedAt: "2026-05-27T10:00:00.000Z", nextAction: "نشر الإعلان في القنوات الداخلية" },
        { id: "task3", title: "التنسيق مع المدرب", description: "تأكيد الموعد والمتطلبات الفنية مع د. منى الزهراني", assignedUserId: "internal", assignee: "محرر الابتكار الداخلي", priority: "HIGH", assignedAt: "2026-05-20", dueDate: "2026-06-05", status: "COMPLETED", completedAt: "2026-06-04T08:00:00.000Z", nextAction: "تأكيد الوصول يوم الورشة" },
        { id: "task4", title: "تسجيل الحضور", description: "توثيق حضور المشاركين وقت الورشة", assignedUserId: "internal", assignee: "محرر الابتكار الداخلي", priority: "MEDIUM", assignedAt: "2026-06-10", dueDate: "2026-06-10", status: "COMPLETED", completedAt: "2026-06-10T13:00:00.000Z", nextAction: "رفع كشف الحضور" },
        { id: "task5", title: "إعداد تقرير الإنجاز", description: "توثيق نتائج الورشة ومؤشرات الرضا ورفعه كدليل", assignedUserId: "admin", assignee: "مدير النظام", priority: "HIGH", assignedAt: "2026-06-11", dueDate: "2026-06-15", status: "COMPLETED", completedAt: "2026-06-14T09:00:00.000Z", nextAction: "رفع التقرير كدليل معتمد" },
      ],
      meetings: [{ id: "meet1", name: "اجتماع تحضيري مع المدربة", type: "تحضيري", date: "2026-05-22", location: "Online", organizer: "نورة العتيبي", decisions: "اعتماد جدول الورشة ومحاورها الثلاثة" }],
      participants: [
        { id: "p1", name: "سلطان الغامدي", organization: "إدارة الخدمات الرقمية", category: "موظف", attendance: "حضر" },
        { id: "p2", name: "منى القحطاني", organization: "إدارة الموارد البشرية", category: "موظف", attendance: "حضر" },
        { id: "p3", name: "فيصل الدوسري", organization: "إدارة التقنية والبنية الرقمية", category: "موظف", attendance: "حضر" },
      ],
      files: [
        { id: "f1", title: "الحقيبة التدريبية", category: "مادة تدريبية", fileName: "innovation-thinking-toolkit.pdf", reviewState: "معتمد", markedAsEvidence: "لا" },
        { id: "f2", title: "تقرير إنجاز الورشة", category: "دليل", fileName: "workshop-completion-report.pdf", reviewState: "معتمد", markedAsEvidence: "نعم" },
      ],
      outputs: [{ id: "o1", name: "استبيان قياس الأثر التوعوي", type: "قياس أثر", owner: "نورة العتيبي", status: "مكتمل" }],
      log: [
        { date: "2026-05-15T08:00:00.000Z", action: "إنشاء نشاط الورشة وإسناد مهام التحضير" },
        { date: "2026-06-10T13:00:00.000Z", action: "تنفيذ الورشة وتوثيق الحضور" },
        { date: "2026-06-14T09:00:00.000Z", action: "إغلاق النشاط بعد استكمال قائمة الإغلاق" },
      ],
    },
    {
      id: "culture-awareness-meeting",
      name: "لقاء توعوي: ثقافة الابتكار وأثرها المؤسسي",
      cultureType: "لقاء توعوي",
      awarenessGoal: "التعريف بمفهوم ثقافة الابتكار المؤسسي وأثرها على جودة الخدمات، ودور كل موظف في تبنّيها.",
      targetSegment: "جميع منسوبي الجهة",
      department: "إدارة التواصل الداخلي",
      startDate: "2026-07-05",
      endDate: "2026-07-05",
      status: "مكتملة",
      knowledgeTopic: "",
      presenter: "نورة العتيبي",
      outcomeDescription: "حضر اللقاء أكثر من 60 موظفًا، وأظهرت التغذية الراجعة وضوحًا أعلى لمفهوم ثقافة الابتكار ودور اللجنة المؤسسية.",
      annualPlanActivityId: "",
      annualPlanActivityName: "",
      milestones: [{ id: "m1", title: "اعتماد محتوى اللقاء", date: "2026-06-25", owner: "نورة العتيبي", status: "مكتملة" }],
      team: [{ id: "t1", name: "نورة العتيبي", department: "إدارة التواصل الداخلي", role: "مقدمة اللقاء", responsibilities: "الإعداد والتقديم" }],
      tasks: [
        { id: "task1", title: "دعوة المشاركين", description: "إرسال الدعوات لجميع الإدارات", assignedUserId: "internal", assignee: "محرر الابتكار الداخلي", priority: "MEDIUM", assignedAt: "2026-06-20", dueDate: "2026-06-28", status: "COMPLETED", completedAt: "2026-06-27T09:00:00.000Z", nextAction: "متابعة التأكيدات" },
        { id: "task2", title: "تجهيز القاعة", description: "حجز القاعة والتجهيزات الصوتية", assignedUserId: "admin", assignee: "مدير النظام", priority: "MEDIUM", assignedAt: "2026-06-22", dueDate: "2026-07-04", status: "COMPLETED", completedAt: "2026-07-03T10:00:00.000Z", nextAction: "تأكيد التجهيزات يوم اللقاء" },
        { id: "task3", title: "رفع المواد", description: "رفع عرض اللقاء بعد التنفيذ", assignedUserId: "internal", assignee: "محرر الابتكار الداخلي", priority: "LOW", assignedAt: "2026-07-05", dueDate: "2026-07-08", status: "COMPLETED", completedAt: "2026-07-07T09:00:00.000Z", nextAction: "رفع الملف النهائي كدليل" },
      ],
      meetings: [],
      participants: [
        { id: "p1", name: "عبدالله الشمري", organization: "إدارة الشؤون المالية", category: "موظف", attendance: "حضر" },
        { id: "p2", name: "ريم العنزي", organization: "إدارة الموارد البشرية", category: "موظف", attendance: "حضر" },
      ],
      files: [{ id: "f1", title: "عرض اللقاء التوعوي", category: "عرض تقديمي", fileName: "innovation-culture-awareness.pptx", reviewState: "قيد المراجعة", markedAsEvidence: "نعم" }],
      outputs: [{ id: "o1", name: "تقرير إنجاز اللقاء", type: "تقرير", owner: "نورة العتيبي", status: "قيد المراجعة" }],
      log: [
        { date: "2026-06-20T08:00:00.000Z", action: "إنشاء اللقاء وإسناد مهام التحضير" },
        { date: "2026-07-05T12:00:00.000Z", action: "تنفيذ اللقاء التوعوي" },
        { date: "2026-07-07T09:00:00.000Z", action: "إغلاق النشاط بعد استكمال قائمة الإغلاق" },
      ],
    },
    {
      id: "culture-knowledge-transfer",
      name: "جلسة نقل معرفة: دروس مستفادة من هاكاثون المدن المستدامة",
      cultureType: "جلسة نقل معرفة",
      awarenessGoal: "نقل الدروس المستفادة والممارسات الناجحة من هاكاثون المدن المستدامة إلى بقية الإدارات ومنسقي الابتكار.",
      targetSegment: "قادة الفرق ومنسقو الابتكار في الإدارات",
      department: "إدارة الابتكار المؤسسي",
      startDate: "2026-09-05",
      endDate: "2026-09-05",
      status: "قيد التنفيذ",
      knowledgeTopic: "دروس ومخرجات هاكاثون المدن المستدامة 2026",
      presenter: "خالد القحطاني",
      outcomeDescription: "",
      annualPlanActivityId: "",
      annualPlanActivityName: "",
      milestones: [{ id: "m1", title: "اعتماد محتوى الجلسة", date: "2026-08-25", owner: "خالد القحطاني", status: "قيد التنفيذ" }],
      team: [{ id: "t1", name: "خالد القحطاني", department: "إدارة الابتكار المؤسسي", role: "مقدم الجلسة", responsibilities: "إعداد محتوى الدروس المستفادة" }],
      tasks: [
        { id: "task1", title: "تجهيز المحتوى", description: "توثيق الدروس المستفادة من الهاكاثون", assignedUserId: "internal", assignee: "محرر الابتكار الداخلي", priority: "HIGH", assignedAt: "2026-08-15", dueDate: "2026-08-29", status: "IN_PROGRESS", nextAction: "استكمال ملخص الدروس المستفادة" },
        { id: "task2", title: "دعوة المشاركين", description: "دعوة منسقي الابتكار في الإدارات", assignedUserId: "admin", assignee: "مدير النظام", priority: "MEDIUM", assignedAt: "2026-08-18", dueDate: "2026-08-30", status: "NOT_STARTED", nextAction: "إرسال الدعوات" },
      ],
      meetings: [],
      participants: [{ id: "p1", name: "سارة الحربي", organization: "إدارة البرامج والفعاليات", category: "موظف", attendance: "مسجل" }],
      files: [],
      outputs: [],
      log: [{ date: "2026-08-15T08:00:00.000Z", action: "إنشاء الجلسة وإسناد مهام التحضير" }],
    },
  ],
};

export function cultureActivitiesForPersona(persona?: string): WorkspaceData {
  const copy = structuredClone(PREVIEW_CULTURE_ACTIVITIES);
  const activities = (copy.cultureActivities as Record<string, unknown>[]) ?? [];
  if (persona === "partner") copy.cultureActivities = activities.map((row) => ({ ...row, team: [], tasks: [], log: [] }));
  if (persona === "viewer") copy.cultureActivities = activities.map((row) => ({ ...row, team: [], tasks: [], participants: [], files: [], log: [] }));
  return copy;
}
