export interface PreviewInnovatorAccount {
  id: string;
  name: string;
  email: string;
  department: string;
  ideaTitle: string;
  stage: string;
  task: string;
  progress: number;
  dueDate: string;
}

export const PREVIEW_INNOVATOR_STORAGE_KEY = "innovation-platform.preview-innovators.v1";

export const DEFAULT_PREVIEW_INNOVATOR: PreviewInnovatorAccount = {
  id: "sarah-innovator",
  name: "سارة القحطاني",
  email: "innovator@innovation.local",
  department: "إدارة تجربة المستفيد",
  ideaTitle: "مساعد ذكي لطلبات المستفيدين",
  stage: "دورة الابتكار",
  task: "التحقق من المشكلة",
  progress: 31,
  dueDate: "19 سبتمبر 2026",
};

const accountSeeds = [
  ["ريم الشهري", "مركز الأبحاث", "منصة مشاركة المعدات البحثية", "دورة الابتكار", "النموذج الأولي", 56],
  ["خالد الحربي", "إدارة المرافق", "نظام تنبؤ باستهلاك الطاقة", "الاحتضان", "الاختبار", 68],
  ["نورة العتيبي", "إدارة التحول المؤسسي", "لوحة متابعة المبادرات الداخلية", "التقييم الأولي", "تحديد المشكلة", 18],
  ["ماجد السالم", "إدارة الخدمات الرقمية", "بوابة المواعيد الاستباقية", "مسرعة الأعمال", "النتائج", 77],
] as const;

export function createPreviewInnovator(sequence: number): PreviewInnovatorAccount {
  const seed = accountSeeds[sequence % accountSeeds.length];
  const suffix = sequence + 1;
  return {
    id: `innovator-${Date.now()}-${suffix}`,
    name: seed[0],
    email: `innovator.${Date.now()}@preview.local`,
    department: seed[1],
    ideaTitle: seed[2],
    stage: seed[3],
    task: seed[4],
    progress: seed[5],
    dueDate: `${20 + (sequence % 7)} أكتوبر 2026`,
  };
}

export function readPreviewInnovators(raw: string | null): PreviewInnovatorAccount[] {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((item) => item && typeof item.id === "string" && typeof item.name === "string") : [];
  } catch {
    return [];
  }
}
