import type { WorkspaceData } from "./workspace-status";

// 5.23.3 Requirement 02 — تفعيل الوحدة أو اللجنة واعتماد العمليات والإجراءات.
// Committee references below (committeeIds/committeeId) point at the SAME
// committeeId values used in preview-committee-fixture.ts's PREVIEW_COMMITTEE
// — this is intentionally the only committee source; nothing here duplicates
// or re-declares a committee. The linked initiative reuses the existing
// 5.23.1.2 preview initiative "مختبر تحسين رحلة المستفيد" instead of
// inventing a new one.
const INNOVATION_COMMITTEE_ID = "preview-committee-innovation";
const TECHNICAL_COMMITTEE_ID = "preview-committee-technical";
const LINKED_INITIATIVE = "مختبر تحسين رحلة المستفيد";

export const PREVIEW_GOVERNANCE_OPERATIONS: WorkspaceData = {
  processes: [
    {
      id: "process-review-approve",
      name: "مراجعة واعتماد مبادرات الابتكار",
      type: "عملية",
      purpose: "ضمان مراجعة كل مبادرة ابتكار من الناحية الفنية والمؤسسية قبل اعتمادها والانتقال بها للتنفيذ.",
      description: "تستقبل وحدة الابتكار طلب المراجعة، وتحيله للجنة التقنية لتقييم الجدوى الفنية، ثم تُرفع التوصية للجنة الابتكار المؤسسي للاعتماد النهائي.",
      owner: "منسقة وحدة الابتكار",
      department: "إدارة الابتكار والتحول الرقمي",
      committeeIds: [INNOVATION_COMMITTEE_ID, TECHNICAL_COMMITTEE_ID],
      stakeholders: "وحدة الابتكار، اللجنة التقنية، لجنة الابتكار المؤسسي، الإدارة صاحبة المبادرة",
      inputs: "بطاقة المبادرة، دراسة الجدوى الأولية",
      steps: "استقبال الطلب ← مراجعة تقنية ← توصية اللجنة التقنية ← اعتماد لجنة الابتكار المؤسسي ← إبلاغ الإدارة المالكة",
      outputs: "قرار اعتماد أو إعادة للتطوير، محضر مراجعة",
      approvalStatus: "معتمد",
      effectiveDate: "2026-03-15",
      version: "1.1",
      notes: "أول عملية معتمدة ضمن تفعيل حوكمة الابتكار.",
    },
  ],
  policies: [
    {
      id: "policy-innovation-governance",
      name: "سياسة حوكمة الابتكار المؤسسي",
      recordType: "سياسة",
      owner: "نورة العتيبي",
      version: "2.0",
      effectiveDate: "2026-03-01",
      reviewDate: "2027-03-01",
      approvalStatus: "معتمد",
      committeeIds: [INNOVATION_COMMITTEE_ID],
      relatedProcessName: "مراجعة واعتماد مبادرات الابتكار",
      notes: "السياسة الإطارية التي تستند إليها عملية المراجعة والاعتماد.",
    },
    {
      id: "policy-technical-review-guide",
      name: "دليل المراجعة التقنية للمبادرات",
      recordType: "دليل عمل",
      owner: "فيصل الدوسري",
      version: "1.0",
      effectiveDate: "2026-03-10",
      reviewDate: "2027-03-10",
      approvalStatus: "قيد المراجعة",
      committeeIds: [TECHNICAL_COMMITTEE_ID],
      relatedProcessName: "مراجعة واعتماد مبادرات الابتكار",
      notes: "دليل تشغيلي لأعضاء اللجنة التقنية.",
    },
  ],
  reviews: [
    {
      id: "review-innovation-lab",
      subject: "مراجعة مبادرة مختبر تحسين رحلة المستفيد قبل التوسع",
      type: "مراجعة تقنية",
      relatedRecord: "مبادرة: مختبر تحسين رحلة المستفيد",
      relatedInitiative: LINKED_INITIATIVE,
      committeeIds: [TECHNICAL_COMMITTEE_ID, INNOVATION_COMMITTEE_ID],
      reviewDate: "2026-08-05",
      requestedBy: "خالد القحطاني",
      reviewers: "فيصل الدوسري، د. سارة الحربي",
      decision: "الموافقة على التوسع مع متابعة مؤشر رضا المستفيدين",
      notes: "مرفق محضر المراجعة التقنية ضمن مستندات الإثبات.",
      nextAction: "رفع التوصية للجنة الابتكار المؤسسي للاعتماد النهائي",
    },
  ],
  decisions: [
    {
      id: "decision-lab-expansion",
      referenceNumber: "GOV-2026-002",
      subject: "اعتماد التوسع في مبادرة مختبر تحسين رحلة المستفيد",
      committeeIds: [INNOVATION_COMMITTEE_ID],
      decisionDate: "2026-08-12",
      decisionText: "اعتماد التوسع في المبادرة على مرحلتين، وتكليف وحدة الابتكار بمتابعة التنفيذ ورفع تقرير أداء ربعي.",
      responsible: "منسقة وحدة الابتكار",
      dueDate: "2026-11-30",
      status: "قيد التنفيذ",
      relatedInitiative: LINKED_INITIATIVE,
      notes: "اعتُمد القرار بعد استكمال المراجعة التقنية.",
    },
  ],
  correctiveActions: [
    {
      id: "corrective-report-delay",
      reason: "تأخر رفع تقرير الأداء الربعي لمبادرة مختبر تحسين رحلة المستفيد عن الموعد المحدد.",
      action: "إعداد التقرير المتأخر ورفعه خلال أسبوع مع توثيق أسباب التأخر.",
      responsible: "خالد القحطاني",
      assignedUserId: "internal",
      committeeId: INNOVATION_COMMITTEE_ID,
      assignedAt: "2026-08-15",
      dueDate: "2026-08-22",
      status: "قيد التنفيذ",
      result: "",
    },
  ],
  performanceReports: [
    {
      id: "report-q3-2026",
      period: "الربع الثالث 2026",
      entity: "لجنة الابتكار المؤسسي",
      committeeIds: [INNOVATION_COMMITTEE_ID, TECHNICAL_COMMITTEE_ID],
      scope: "أداء العمليات المعتمدة والمبادرات قيد التنفيذ خلال الربع الثالث.",
      indicators: "عدد العمليات المعتمدة: 1، عدد المراجعات: 1، عدد القرارات: 1، الإجراءات التصحيحية المفتوحة: 1",
      summary: "أداء مستقر مع فجوة واحدة في الالتزام بمواعيد التقارير الدورية تمت معالجتها بإجراء تصحيحي.",
      resultingDecisions: "قرار اعتماد التوسع في مبادرة مختبر تحسين رحلة المستفيد",
      correctiveActionsNote: "متابعة تأخر رفع التقرير الربعي",
      status: "معتمد",
    },
  ],
  tasks: [
    {
      id: "task-initiative-card",
      title: "تجهيز بطاقة مبادرة منصة التجارب الرقمية للمراجعة القادمة",
      description: "تحديث بيانات بطاقة المبادرة تمهيدًا لعرضها على اللجنة التقنية.",
      relatedRecordType: "عملية/إجراء",
      relatedRecordLabel: "مراجعة واعتماد مبادرات الابتكار",
      committeeId: TECHNICAL_COMMITTEE_ID,
      assignedUserId: "admin",
      assignee: "مدير النظام",
      priority: "MEDIUM",
      assignedAt: "2026-08-16",
      dueDate: "2026-08-28",
      status: "IN_PROGRESS",
      completedAt: null,
      nextAction: "استكمال بطاقة المبادرة",
    },
  ],
  log: [
    { date: "2026-03-15T09:00:00.000Z", action: "اعتماد عملية مراجعة واعتماد مبادرات الابتكار" },
    { date: "2026-08-05T10:00:00.000Z", action: "توثيق مراجعة تقنية لمبادرة مختبر تحسين رحلة المستفيد" },
    { date: "2026-08-12T11:00:00.000Z", action: "تسجيل قرار اعتماد التوسع في المبادرة" },
    { date: "2026-08-15T08:00:00.000Z", action: "فتح إجراء تصحيحي بشأن تأخر تقرير الأداء" },
  ],
};

export function governanceOperationsForPersona(persona?: string): WorkspaceData {
  const copy = structuredClone(PREVIEW_GOVERNANCE_OPERATIONS);
  if (persona === "partner" || persona === "viewer") {
    copy.tasks = [];
    copy.log = [];
    copy.correctiveActions = (copy.correctiveActions as Record<string, unknown>[]).map((row) => ({ ...row, responsible: "", assignedUserId: "" }));
  }
  return copy;
}
