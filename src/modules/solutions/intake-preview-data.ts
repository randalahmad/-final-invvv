export type PreviewSubmissionState = "مسودة" | "مقدمة" | "قيد المراجعة" | "يحتاج استكمال" | "محالة للإدارة المختصة" | "قيد التقييم" | "بانتظار القرار" | "مقبولة" | "غير مناسبة حاليًا" | "مكرر / موجود مسبقًا";

export const PREVIEW_INTAKE_PAGES = [
  { id: "public", name: "بوابة الابتكار العامة", audience: "الجمهور والموظفون", status: "مفتوحة", submissions: 18, owner: "إدارة الابتكار المؤسسي", created: "10 يناير 2026" },
  { id: "digital", name: "مقترحات تحسين الخدمات الرقمية", audience: "المستفيدون والموظفون", status: "مفتوحة", submissions: 9, owner: "إدارة الخدمات الرقمية", created: "2 مارس 2026" },
  { id: "employees", name: "أفكار موظفي الجهة", audience: "موظفو الجهة", status: "مفتوحة دائمًا", submissions: 24, owner: "إدارة الابتكار المؤسسي", created: "15 نوفمبر 2025" },
] as const;

export const PREVIEW_IDEA_SUBMISSIONS = [
  { id: "new-service", name: "مسار رقمي موحد لطلبات المستفيد", submitter: "هند الشمري", department: "تجربة المستفيد", received: "24 أغسطس 2026", stage: "فكرة", status: "قيد المراجعة" as PreviewSubmissionState, source: "بوابة الابتكار العامة", owner: "نورة العتيبي", next: "المراجعة الأولية" },
  { id: "support-platform", name: "منصة متابعة طلبات الدعم الموحدة", submitter: "أمل القحطاني", department: "تقنية المعلومات", received: "22 أغسطس 2026", stage: "حل", status: "يحتاج استكمال" as PreviewSubmissionState, source: "أفكار موظفي الجهة", owner: "سارة الحربي", next: "استكمال دراسة الجدوى" },
  { id: "smart-archive", name: "أرشفة ذكية للمراسلات الداخلية", submitter: "فيصل الدوسري", department: "إدارة الوثائق", received: "20 أغسطس 2026", stage: "فكرة", status: "محالة للإدارة المختصة" as PreviewSubmissionState, source: "أفكار موظفي الجهة", owner: "خالد القحطاني", next: "رد إدارة تقنية المعلومات" },
  { id: "energy-monitor", name: "مراقبة استهلاك الطاقة لحظيًا", submitter: "ريم الشهري", department: "إدارة المرافق", received: "18 أغسطس 2026", stage: "PoC", status: "قيد التقييم" as PreviewSubmissionState, source: "مقترحات تحسين الخدمات الرقمية", owner: "ماجد السالم", next: "تسجيل توصية المقيّم" },
  { id: "appointments", name: "بوابة المواعيد الاستباقية", submitter: "ليان المطيري", department: "الخدمات الرقمية", received: "12 أغسطس 2026", stage: "نموذج عمل", status: "مقبولة" as PreviewSubmissionState, source: "بوابة الابتكار العامة", owner: "نورة العتيبي", next: "متابعة خطة التجربة" },
  { id: "duplicate-assistant", name: "مساعد المستفيد الرقمي", submitter: "أحمد السالم", department: "القنوات الرقمية", received: "9 أغسطس 2026", stage: "فكرة", status: "مكرر / موجود مسبقًا" as PreviewSubmissionState, source: "بوابة الابتكار العامة", owner: "سارة القحطاني", next: "ربط الطلب بالسجل الموجود" },
] as const;
