export const PORTFOLIO_STATUS_LABELS: Record<string, string> = {
  RECEIVED: "جديد / مستلم", NEEDS_COMPLETION: "يحتاج استكمال", UNDER_REVIEW: "قيد المراجعة",
  ACCEPTED: "مقبول في السجل", IN_PROGRESS: "قيد التنفيذ", OPERATIONAL: "تشغيلي",
  ON_HOLD: "متوقف", ARCHIVED: "مؤرشف", REJECTED: "مرفوض",
};

export type BeneficiaryGroup = { segment: string; description?: string; count?: number; type?: string; scope?: string; notes?: string };
export type JourneyEntry = { stage: string; date?: string; description: string; owner?: string; implemented?: string; result?: string; decisions?: string; nextStep?: string };

export function normalizeSolutionTitle(value: string): string {
  return value.normalize("NFKD").replace(/[\u064B-\u065F\u0670]/g, "").replace(/[إأآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/[^\p{L}\p{N}]+/gu, " ").trim().toLowerCase();
}

export function solutionFingerprint(input: { nameAr: string; externalReferenceId?: string | null; sourceRecordType?: string | null; sourceRecordId?: string | null }): string {
  if (input.externalReferenceId?.trim()) return `ref:${input.externalReferenceId.trim().toLowerCase()}`;
  if (input.sourceRecordType && input.sourceRecordId) return `source:${input.sourceRecordType}:${input.sourceRecordId}`;
  return `title:${normalizeSolutionTitle(input.nameAr)}`;
}

export function detectPotentialDuplicates(candidate: { nameAr: string; externalReferenceId?: string | null; sourceRecordType?: string | null; sourceRecordId?: string | null }, existing: Array<typeof candidate & { id: string }>) {
  const fingerprint = solutionFingerprint(candidate);
  return existing.filter((row) => solutionFingerprint(row) === fingerprint || normalizeSolutionTitle(row.nameAr) === normalizeSolutionTitle(candidate.nameAr));
}

export function computePortfolioReadiness(solution: Record<string, unknown>) {
  const dimensions = [
    { key: "basic", label: "البيانات الأساسية", ok: Boolean(solution.nameAr && solution.description && solution.problemStatement) },
    { key: "ownership", label: "الملكية والمسؤولية", ok: Boolean(solution.owningDepartmentId && (solution.ownerUserId || solution.operationalOwner)) },
    { key: "strategy", label: "الارتباط الاستراتيجي", ok: Boolean(solution.strategicObjectiveId || solution.innovationObjective || solution.digitalTransformationObjective) },
    { key: "beneficiaries", label: "الفئات والمستفيدون", ok: Boolean(solution.beneficiaryCount || (Array.isArray(solution.beneficiaryGroups) && solution.beneficiaryGroups.length)) },
    { key: "execution", label: "النضج والتنفيذ", ok: Boolean(solution.maturityStage && solution.implementationStatus && (solution.launchDate || solution.startDate)) },
    { key: "documents", label: "الوثائق المساندة", ok: Array.isArray(solution.supportingArtifacts) && solution.supportingArtifacts.length > 0 },
    { key: "followUp", label: "المتابعة التشغيلية", ok: Boolean(solution.nextAction || solution.portfolioStatus === "OPERATIONAL") },
  ];
  const complete = dimensions.filter((item) => item.ok).length;
  return { percentage: Math.round((complete / dimensions.length) * 100), dimensions, missing: dimensions.filter((item) => !item.ok).map((item) => item.label) };
}

export const PREVIEW_PORTFOLIO_SOLUTIONS = [
  { id:"manual-service", nameAr:"بوابة المواعيد الاستباقية", department:"إدارة الخدمات الرقمية", owner:"نورة العتيبي", source:"تقديم مباشر", maturity:"نموذج عمل", status:"مقبول في السجل", beneficiaries:"3,200", readiness:71, tasks:1, nextAction:"اعتماد خطة التجربة", technology:["تحليل البيانات","أتمتة"], duplicateOf:null },
  { id:"citizen-assistant", nameAr:"المساعد الرقمي لخدمات المستفيدين", department:"إدارة تجربة المستفيد", owner:"سارة القحطاني", source:"مبادرة داخلية", maturity:"تشغيل فعلي", status:"تشغيلي", beneficiaries:"18,400", readiness:93, tasks:0, nextAction:"تحديث تقرير الاستخدام الربعي", technology:["الذكاء الاصطناعي","تحليل البيانات"], duplicateOf:null },
  { id:"energy-poc", nameAr:"نظام إدارة الطاقة التنبؤي", department:"إدارة المرافق", owner:"خالد الحربي", source:"ورشة منهجية", maturity:"إثبات مفهوم PoC", status:"قيد التنفيذ", beneficiaries:"12 مبنى", readiness:62, tasks:2, nextAction:"استكمال دراسة الجدوى", technology:["إنترنت الأشياء","تحليل البيانات"], duplicateOf:null },
  { id:"intake-queue", nameAr:"منصة متابعة طلبات الدعم الموحدة", department:"تقنية المعلومات", owner:"بانتظار الإسناد", source:"رابط حصر الحلول", maturity:"مفهوم", status:"جديد / مستلم", beneficiaries:"—", readiness:34, tasks:1, nextAction:"مراجعة طلب الحصر", technology:["أتمتة"], duplicateOf:null },
  { id:"excel-import", nameAr:"لوحة مراقبة جودة البيانات", department:"إدارة البيانات", owner:"نورة العتيبي", source:"استيراد من Excel", maturity:"نموذج أولي", status:"يحتاج استكمال", beneficiaries:"—", readiness:48, tasks:1, nextAction:"استكمال عدد المستفيدين", technology:["تحليل البيانات"], duplicateOf:null },
  { id:"hackathon-transfer", nameAr:"توأم رقمي للمرافق الحكومية", department:"إدارة المرافق", owner:"ريم الشهري", source:"هاكاثون المدن المستدامة", maturity:"تجربة Pilot", status:"قيد المراجعة", beneficiaries:"6 مرافق", readiness:77, tasks:1, nextAction:"رفع تقرير التجربة", technology:["الواقع الممتد","إنترنت الأشياء"], duplicateOf:null },
  { id:"duplicate-assistant", nameAr:"مساعد المستفيد الرقمي", department:"إدارة القنوات الرقمية", owner:"أحمد السالم", source:"رابط حصر الحلول", maturity:"مفهوم", status:"قيد المراجعة", beneficiaries:"—", readiness:29, tasks:1, nextAction:"حسم السجل المشابه", technology:["الذكاء الاصطناعي"], duplicateOf:"citizen-assistant" },
] as const;
