import type { WorkspaceData } from "./workspace-status";

// 5.23.3 Requirement 05 — استقبال المقترحات والتغذية الراجعة. ثلاثة روابط
// استقبال معزولة (بند 13/14): رابط عام للمقترحات (Link 1)، ورابط تغذية
// راجعة على خدمة قائمة محددة (Link 2)، ورابط تحسين تجربة الموظف بإدارة
// ومسؤول مختلفين (Link 3). تتضمن ردود Link 1 مرفقًا واحدًا وردًا مجهولًا
// ومهمة متابعة مسندة وردًا مكتملًا — بيانات تجريبية فقط، لا تُدّعى كإنتاجية.
const link1Fields = [
  { key: "submitterName", label: "الاسم", enabled: true, required: false },
  { key: "submitterEmail", label: "البريد الإلكتروني", enabled: true, required: false },
  { key: "submitterOrg", label: "الجهة/الإدارة", enabled: true, required: false },
  { key: "attachment", label: "مرفق", enabled: true, required: false },
  { key: "consent", label: "الموافقة على مشاركة البيانات مع الجهة", enabled: true, required: true },
  { key: "customQuestion1", label: "ما الأثر المتوقع لهذا المقترح؟", enabled: true, required: false },
];

export const PREVIEW_INTAKE_REFERENCE_SOLUTIONS = [{ id: "preview-solution-appointment-booking", nameAr: "خدمة حجز المواعيد الإلكترونية" }];

export const PREVIEW_INTAKE_LINKS: WorkspaceData = {
  intakeLinks: [
    {
      id: "preview-intake-general",
      token: "preview-token-general-suggestions",
      name: "صندوق مقترحات الابتكار المؤسسي",
      purpose: "استقبال أي مقترح ابتكاري أو تحسيني من الموظفين والمستفيدين على مدار العام، بمعزل عن أي خدمة محددة.",
      type: "كلاهما",
      relatedServiceName: "",
      owningDepartment: "إدارة الابتكار والتحول الرقمي",
      owner: "منسقة وحدة الابتكار",
      targetAudience: "جميع الموظفين والمستفيدين",
      startDate: "2026-01-05",
      closeDate: "",
      status: "نشط",
      participantDescription: "شاركنا مقترحك الابتكاري أو ملاحظتك — سنراجعها ونعود إليك عند الحاجة.",
      instructions: "يرجى وصف المقترح بوضوح؛ يمكن إرفاق ملف داعم (PDF أو DOCX أو XLSX) إن وجد.",
      formFields: link1Fields,
      responses: [
        {
          id: "preview-response-1", referenceNumber: "FB-A1B2C3-001", receivedAt: "2026-08-10T09:15:00.000Z", type: "مقترحات",
          title: "أتمتة تذكير المستفيدين قبل انتهاء الخدمة", description: "اقتراح بإرسال تذكير تلقائي عبر الرسائل النصية قبل ثلاثة أيام من انتهاء صلاحية الخدمة المشترك بها.",
          submitterName: "فهد الدوسري", submitterEmail: "fahad.d@example.gov.sa", submitterOrg: "إدارة خدمة العملاء", anonymous: false,
          relatedServiceName: null, customAnswers: { customQuestion1: "تقليل شكاوى انتهاء الخدمة بنسبة ملموسة" },
          attachments: [{ fileName: "مقترح-التذكير-التلقائي.pdf", mimeType: "application/pdf", size: 182340, storageKey: "preview-storage-key-1" }],
          status: "قيد المراجعة", ownerUserId: "internal", ownerName: "خالد القحطاني", notes: "مبدئيًا يبدو قابلاً للتنفيذ ضمن خطة الربع القادم.",
          tasks: [{ id: "preview-task-1", title: "دراسة الجدوى الفنية للتذكير التلقائي", assignedUserId: "internal", assignee: "خالد القحطاني", priority: "MEDIUM", assignedAt: "2026-08-12", dueDate: "2026-08-26", status: "IN_PROGRESS", nextAction: "فتح مساحة الرد ومتابعته" }],
          history: [{ date: "2026-08-10T09:15:00.000Z", action: "استلام الرد عبر رابط الاستقبال" }, { date: "2026-08-11T10:00:00.000Z", action: "تحديث حالة الرد إلى «قيد المراجعة»" }, { date: "2026-08-12T08:30:00.000Z", action: "إسناد مهمة متابعة إلى خالد القحطاني" }],
        },
        {
          id: "preview-response-2", referenceNumber: "FB-A1B2C3-002", receivedAt: "2026-08-14T13:40:00.000Z", type: "تغذية راجعة",
          title: "صعوبة الوصول لصفحة الدعم الفني من الجوال", description: "واجهة الدعم الفني غير متجاوبة بشكل جيد على شاشات الجوال الصغيرة، مما يصعّب تعبئة النموذج.",
          submitterName: null, submitterEmail: null, submitterOrg: null, anonymous: true,
          relatedServiceName: null, customAnswers: {}, attachments: [],
          status: "جديد", ownerUserId: null, notes: "",
          tasks: [], history: [{ date: "2026-08-14T13:40:00.000Z", action: "استلام الرد عبر رابط الاستقبال" }],
        },
        {
          id: "preview-response-3", referenceNumber: "FB-A1B2C3-003", receivedAt: "2026-07-20T08:00:00.000Z", type: "مقترحات",
          title: "لوحة تعريفية لمبادرات الابتكار في الاستقبال", description: "اقتراح بإضافة شاشة عرض في بهو الاستقبال تُبرز أبرز مبادرات الابتكار الجارية والمنجزة.",
          submitterName: "منى العتيبي", submitterEmail: "mona.a@example.gov.sa", submitterOrg: "إدارة الاتصال المؤسسي", anonymous: false,
          relatedServiceName: null, customAnswers: { customQuestion1: "رفع وعي الزوار والموظفين بجهود الابتكار" }, attachments: [],
          status: "تمت المعالجة", ownerUserId: "admin", ownerName: "مدير النظام", notes: "نُفذت الفكرة ضمن خطة تحديث بهو الاستقبال للربع الثالث.",
          tasks: [{ id: "preview-task-2", title: "تنسيق تركيب شاشة العرض مع إدارة المرافق", assignedUserId: "admin", assignee: "مدير النظام", priority: "LOW", assignedAt: "2026-07-21", dueDate: "2026-08-01", status: "COMPLETED", nextAction: "فتح مساحة الرد ومتابعته", completedAt: "2026-07-30T10:00:00.000Z" }],
          history: [{ date: "2026-07-20T08:00:00.000Z", action: "استلام الرد عبر رابط الاستقبال" }, { date: "2026-07-30T11:00:00.000Z", action: "تحديث حالة الرد إلى «تمت المعالجة»" }],
        },
      ],
      log: [
        { date: "2026-01-05T08:00:00.000Z", action: "إنشاء رابط الاستقبال" },
        { date: "2026-01-06T09:00:00.000Z", action: "تغيير حالة الرابط إلى «نشط»" },
      ],
    },
    {
      id: "preview-intake-service-feedback",
      token: "preview-token-service-feedback",
      name: "تغذية راجعة على خدمة حجز المواعيد الإلكترونية",
      purpose: "استقبال ملاحظات المستفيدين تحديدًا حول تجربة استخدام خدمة حجز المواعيد الإلكترونية بعد إطلاق نسختها المحدثة.",
      type: "تغذية راجعة",
      relatedServiceName: "خدمة حجز المواعيد الإلكترونية",
      owningDepartment: "إدارة تجربة المستفيد",
      owner: "سارة المطيري",
      targetAudience: "مستخدمو خدمة حجز المواعيد الإلكترونية",
      startDate: "2026-05-01",
      closeDate: "",
      status: "نشط",
      participantDescription: "شاركنا رأيك في تجربة حجز الموعد الإلكتروني الجديدة لمساعدتنا على تحسينها.",
      instructions: "",
      formFields: [
        { key: "submitterName", label: "الاسم", enabled: true, required: false },
        { key: "submitterEmail", label: "البريد الإلكتروني", enabled: true, required: false },
        { key: "submitterOrg", label: "الجهة/الإدارة", enabled: false, required: false },
        { key: "attachment", label: "مرفق", enabled: false, required: false },
        { key: "consent", label: "الموافقة على مشاركة البيانات مع الجهة", enabled: false, required: false },
        { key: "customQuestion1", label: "سؤال إضافي (اختياري)", enabled: false, required: false },
      ],
      responses: [
        {
          id: "preview-response-4", referenceNumber: "FB-D4E5F6-001", receivedAt: "2026-08-05T10:20:00.000Z", type: "تغذية راجعة",
          title: "بطء تحميل قائمة الأوقات المتاحة", description: "قائمة الأوقات المتاحة تستغرق وقتًا طويلاً للتحميل عند اختيار عيادة معينة.",
          submitterName: "عبدالله الشهراني", submitterEmail: "a.shahrani@example.com", submitterOrg: null, anonymous: false,
          relatedServiceName: "خدمة حجز المواعيد الإلكترونية", customAnswers: {}, attachments: [],
          status: "تم الإسناد", ownerUserId: "internal", ownerName: "خالد القحطاني", notes: "يبدو مرتبطًا بحمل الخادم وقت الذروة — يحتاج تحقق فني.",
          tasks: [{ id: "preview-task-3", title: "تحقق فني من زمن استجابة قائمة الأوقات", assignedUserId: "internal", assignee: "خالد القحطاني", priority: "HIGH", assignedAt: "2026-08-06", dueDate: "2026-08-13", status: "NOT_STARTED", nextAction: "فتح مساحة الرد ومتابعته" }],
          history: [{ date: "2026-08-05T10:20:00.000Z", action: "استلام الرد عبر رابط الاستقبال" }, { date: "2026-08-06T09:00:00.000Z", action: "إسناد الرد إلى خالد القحطاني" }],
        },
        {
          id: "preview-response-5", referenceNumber: "FB-D4E5F6-002", receivedAt: "2026-08-16T15:05:00.000Z", type: "تغذية راجعة",
          title: "تجربة الحجز أصبحت أسهل بعد التحديث", description: "أشكركم على التحديث — عدد الخطوات أصبح أقل وواجهة أوضح من السابق.",
          submitterName: "هند القحطاني", submitterEmail: "hind.q@example.com", submitterOrg: null, anonymous: false,
          relatedServiceName: "خدمة حجز المواعيد الإلكترونية", customAnswers: {}, attachments: [],
          status: "مغلق", ownerUserId: "admin", ownerName: "مدير النظام", notes: "ملاحظة إيجابية — لا يلزم إجراء إضافي.",
          tasks: [], history: [{ date: "2026-08-16T15:05:00.000Z", action: "استلام الرد عبر رابط الاستقبال" }, { date: "2026-08-17T09:00:00.000Z", action: "إغلاق الرد" }],
        },
      ],
      log: [
        { date: "2026-05-01T08:00:00.000Z", action: "إنشاء رابط الاستقبال" },
        { date: "2026-05-01T08:10:00.000Z", action: "تغيير حالة الرابط إلى «نشط»" },
      ],
    },
    {
      id: "preview-intake-employee-experience",
      token: "preview-token-employee-experience",
      name: "تحسين تجربة الموظف الداخلية",
      purpose: "استقبال مقترحات الموظفين لتحسين بيئة العمل والإجراءات الداخلية اليومية.",
      type: "مقترحات",
      relatedServiceName: "",
      owningDepartment: "إدارة الموارد البشرية",
      owner: "ريم الحربي",
      targetAudience: "موظفو الجهة",
      startDate: "2026-03-01",
      closeDate: "2026-12-31",
      status: "نشط",
      participantDescription: "شاركنا مقترحك لتحسين تجربتك كموظف داخل الجهة.",
      instructions: "المقترحات المتعلقة بالسياسات الإدارية تُحال تلقائيًا إلى إدارة الموارد البشرية للمراجعة.",
      formFields: link1Fields.map((field) => (field.key === "consent" ? { ...field, enabled: true, required: false } : field)),
      responses: [
        {
          id: "preview-response-6", referenceNumber: "FB-G7H8I9-001", receivedAt: "2026-06-02T09:00:00.000Z", type: "مقترحات",
          title: "منصة داخلية لتبادل المعرفة بين الإدارات", description: "اقتراح إنشاء مساحة داخلية بسيطة لمشاركة الدروس المستفادة بين الإدارات المختلفة.",
          submitterName: "ماجد العنزي", submitterEmail: "majed.a@example.gov.sa", submitterOrg: "إدارة الموارد البشرية", anonymous: false,
          relatedServiceName: null, customAnswers: { customQuestion1: "تقليل تكرار الأخطاء وتسريع التعلم بين الفرق" }, attachments: [],
          status: "قيد المراجعة", ownerUserId: "internal", ownerName: "خالد القحطاني", notes: "",
          tasks: [], history: [{ date: "2026-06-02T09:00:00.000Z", action: "استلام الرد عبر رابط الاستقبال" }, { date: "2026-06-03T09:00:00.000Z", action: "تحديث حالة الرد إلى «قيد المراجعة»" }],
        },
        {
          id: "preview-response-7", referenceNumber: "FB-G7H8I9-002", receivedAt: "2026-06-18T11:30:00.000Z", type: "مقترحات",
          title: "مرونة أكبر في مواعيد بدء الدوام", description: "اقتراح بتوسيع نافذة بدء الدوام المرن لتشمل ساعة إضافية صباحًا.",
          submitterName: "لطيفة السبيعي", submitterEmail: "latifa.s@example.gov.sa", submitterOrg: "إدارة تقنية المعلومات", anonymous: false,
          relatedServiceName: null, customAnswers: {}, attachments: [],
          status: "غير قابل للتنفيذ", ownerUserId: "admin", ownerName: "مدير النظام", notes: "يتعارض مع سياسة الدوام المعتمدة حاليًا من الجهة المختصة — تم التوضيح للمقترح.",
          tasks: [], history: [{ date: "2026-06-18T11:30:00.000Z", action: "استلام الرد عبر رابط الاستقبال" }, { date: "2026-06-25T09:00:00.000Z", action: "تحديث حالة الرد إلى «غير قابل للتنفيذ»" }],
        },
        {
          id: "preview-response-8", referenceNumber: "FB-G7H8I9-003", receivedAt: "2026-08-01T09:45:00.000Z", type: "مقترحات",
          title: "تبسيط نموذج طلب الإجازة الداخلي", description: "النموذج الحالي يطلب بيانات مكررة موجودة أصلًا في ملف الموظف.",
          submitterName: null, submitterEmail: null, submitterOrg: null, anonymous: true,
          relatedServiceName: null, customAnswers: {}, attachments: [],
          status: "جديد", ownerUserId: null, notes: "",
          tasks: [], history: [{ date: "2026-08-01T09:45:00.000Z", action: "استلام الرد عبر رابط الاستقبال" }],
        },
      ],
      log: [
        { date: "2026-03-01T08:00:00.000Z", action: "إنشاء رابط الاستقبال" },
        { date: "2026-03-01T08:15:00.000Z", action: "تغيير حالة الرابط إلى «نشط»" },
      ],
    },
  ],
};

export function intakeLinksForPersona(persona?: string): WorkspaceData {
  const copy = structuredClone(PREVIEW_INTAKE_LINKS);
  const links = (copy.intakeLinks as Record<string, unknown>[]) ?? [];
  if (persona === "partner") { copy.intakeLinks = []; return copy; }
  if (persona === "viewer") {
    copy.intakeLinks = links.map((link) => ({
      ...link,
      log: [],
      responses: (Array.isArray(link.responses) ? (link.responses as Record<string, unknown>[]) : []).map((r) => ({ ...r, submitterName: null, submitterEmail: null, submitterOrg: null, tasks: [] })),
    }));
  }
  return copy;
}
