export type ImpactCategory = "مالي / خفض تكاليف" | "تشغيلي / وقت وجهد" | "رضا المستفيدين" | "عدد المستفيدين" | "جودة الخدمة" | "أثر رقمي" | "فئة أخرى";

export type PreviewImpactMeasurement = {
  id: string; solutionId: string; indicator: string; description: string; category: ImpactCategory;
  baseline: number; target: number; actual: number | null; unit: string; period: string;
  source: string; owner: string; verification: "لم يبدأ" | "بانتظار التحقق" | "تم التحقق";
  notes: string; evidence: string | null; lastMeasuredAt: string | null; nextMeasuredAt: string;
};

export const IMPACT_SOLUTIONS = [
  { id: "citizen-assistant", name: "المساعد الرقمي لخدمات المستفيدين", status: "تشغيلي", expectedImpact: "تقليل زمن الوصول إلى الخدمة ورفع رضا المستفيدين" },
  { id: "manual-service", name: "بوابة المواعيد الاستباقية", status: "مقبول للتجربة", expectedImpact: "خفض حالات عدم الحضور وتحسين استغلال المواعيد" },
] as const;

export const PREVIEW_IMPACT_MEASUREMENTS: PreviewImpactMeasurement[] = [
  { id:"m1",solutionId:"citizen-assistant",indicator:"متوسط زمن الوصول إلى الخدمة",description:"الوقت من بدء البحث حتى الوصول للخدمة الصحيحة",category:"تشغيلي / وقت وجهد",baseline:12,target:5,actual:6,unit:"دقيقة",period:"الربع الثالث 2026",source:"تحليلات بوابة الخدمات",owner:"سارة القحطاني",verification:"تم التحقق",notes:"تحسن مستقر خلال آخر شهرين.",evidence:"تقرير تحليلات الاستخدام.pdf",lastMeasuredAt:"28 أغسطس 2026",nextMeasuredAt:"30 سبتمبر 2026" },
  { id:"m2",solutionId:"citizen-assistant",indicator:"رضا المستفيدين",description:"نسبة الرضا بعد إتمام رحلة الخدمة",category:"رضا المستفيدين",baseline:71,target:85,actual:82,unit:"%",period:"أغسطس 2026",source:"استبيان ما بعد الخدمة",owner:"ريم الشهري",verification:"بانتظار التحقق",notes:"تحتاج العينة إلى اعتماد إدارة تجربة المستفيد.",evidence:null,lastMeasuredAt:"31 أغسطس 2026",nextMeasuredAt:"30 سبتمبر 2026" },
  { id:"m3",solutionId:"citizen-assistant",indicator:"عدد المستفيدين",description:"المستفيدون الفريدون الذين استخدموا الحل",category:"عدد المستفيدين",baseline:0,target:20000,actual:18400,unit:"مستفيد",period:"منذ الإطلاق",source:"سجل الاستخدام",owner:"خالد الحربي",verification:"تم التحقق",notes:"",evidence:"كشف الاستخدام المعتمد.xlsx",lastMeasuredAt:"31 أغسطس 2026",nextMeasuredAt:"31 ديسمبر 2026" },
];

export function progressTowardTarget(item: PreviewImpactMeasurement) {
  if (item.actual === null || item.target === item.baseline) return 0;
  const direction = item.target >= item.baseline ? 1 : -1;
  const progress = ((item.actual - item.baseline) * direction) / (Math.abs(item.target - item.baseline) || 1);
  return Math.max(0, Math.min(100, Math.round(progress * 100)));
}

export function deriveImpactSummary(measurements = PREVIEW_IMPACT_MEASUREMENTS) {
  const measuredIds = new Set(measurements.filter(item=>item.actual !== null).map(item=>item.solutionId));
  const beneficiaries = measurements.filter(item=>item.category === "عدد المستفيدين" && item.actual !== null).reduce((sum,item)=>sum+(item.actual??0),0);
  const costReduction = measurements.filter(item=>item.category === "مالي / خفض تكاليف" && item.actual !== null).reduce((sum,item)=>sum+(item.actual??0),0);
  return {
    measuredSolutions: measuredIds.size,
    awaitingMeasurement: IMPACT_SOLUTIONS.filter(solution=>!measuredIds.has(solution.id)).length,
    beneficiaries,
    costReduction,
    satisfactionIndicators: measurements.filter(item=>item.category === "رضا المستفيدين" && item.actual !== null).length,
    missingEvidence: measurements.filter(item=>item.actual !== null && !item.evidence).length,
  };
}
