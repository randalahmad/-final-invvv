/**
 * Local DEMO-mode data — used ONLY when DEMO_MODE is active (see db.ts).
 * Never touched by the real (Prisma/PostgreSQL-backed) production path.
 *
 * Role → permission mapping is reused verbatim from `permissions.ts`
 * (DEFAULT_ROLE_PERMISSIONS) — not re-invented — so demo accounts see exactly
 * the same access shape as the real seeded roles.
 */
import { DEFAULT_ROLE_PERMISSIONS, ROLE_KEYS, type RoleKey } from "@/modules/auth/permissions";
import { resolveRuntimeModes } from "@/lib/ux-preview";

export const DEMO_MODE = resolveRuntimeModes().demo;

export interface DemoUser {
  id: string;
  name: string;
  email: string;
  jobTitle: string | null;
  status: "ACTIVE";
  registrationStatus: "APPROVED";
  roleKey: RoleKey;
  departmentId: string | null;
  organizationId: string | null;
}

export const DEMO_ORG = { id: "demo-org-1", nameAr: "الهيئة التجريبية للابتكار الحكومي", type: "INTERNAL", status: "ACTIVE" };
export const DEMO_DEPT = { id: "demo-dept-1", nameAr: "إدارة الابتكار والتحول الرقمي", organizationId: DEMO_ORG.id, status: "ACTIVE" };
export const DEMO_PARTNER_ORG = { id: "demo-org-partner", nameAr: "مركز الشراكة الوطني للابتكار", type: "EXTERNAL", status: "ACTIVE" };
/** Preview-only submitter profile; this is not a production role or login. */
export const DEMO_INNOVATOR = { id: "demo-innovator", name: "هند الشمري (Demo)", email: "innovator@innovation.local", departmentName: "إدارة تجربة المستفيد" };

export const DEMO_USERS: DemoUser[] = [
  { id: "demo-admin", name: "مدير النظام (Demo)", email: "admin@innovation.local", jobTitle: "مدير منصة الابتكار المؤسسي", status: "ACTIVE", registrationStatus: "APPROVED", roleKey: ROLE_KEYS.SYSTEM_ADMIN, departmentId: null, organizationId: null },
  { id: "demo-editor", name: "محرر الابتكار الداخلي (Demo)", email: "editor@innovation.local", jobTitle: "محرر — إدارة الابتكار", status: "ACTIVE", registrationStatus: "APPROVED", roleKey: ROLE_KEYS.INTERNAL_EDITOR, departmentId: DEMO_DEPT.id, organizationId: DEMO_ORG.id },
  { id: "demo-partner", name: "منسّق الشراكة (Demo)", email: "partner@innovation.local", jobTitle: "منسّق شراكة خارجية", status: "ACTIVE", registrationStatus: "APPROVED", roleKey: ROLE_KEYS.EXTERNAL_PARTNER, departmentId: null, organizationId: DEMO_PARTNER_ORG.id },
  { id: "demo-viewer", name: "مطَّلع (Demo)", email: "viewer@innovation.local", jobTitle: "مطَّلع", status: "ACTIVE", registrationStatus: "APPROVED", roleKey: ROLE_KEYS.VIEWER, departmentId: null, organizationId: null },
];

/** Same fixed demo password for every account, checked directly (bypasses bcrypt/DB) in demo mode only. */
export const DEMO_PASSWORD = "Demo@12345";

export function demoUserById(id: string) { return DEMO_USERS.find((u) => u.id === id) ?? null; }
export function demoUserByEmail(email: string) { return DEMO_USERS.find((u) => u.email.toLowerCase() === email.toLowerCase()) ?? null; }

/** Full role-assignment shape matching `userInclude`/access-context.ts's expectations. */
export function demoRoleAssignments(user: DemoUser) {
  const scopeType = user.roleKey === ROLE_KEYS.SYSTEM_ADMIN ? "PLATFORM" : user.roleKey === ROLE_KEYS.EXTERNAL_PARTNER ? "AGREEMENT" : user.roleKey === ROLE_KEYS.VIEWER ? "PUBLISHED" : "DEPARTMENT";
  const scopeId = scopeType === "DEPARTMENT" ? user.departmentId : scopeType === "AGREEMENT" ? "demo-agreement-1" : null;
  return [{
    scopeType,
    scopeId,
    role: {
      key: user.roleKey,
      permissions: DEFAULT_ROLE_PERMISSIONS[user.roleKey].map((key) => ({ permission: { key } })),
    },
  }];
}

// ── Headline content so key pages aren't empty in demo mode ────────────────

export const DEMO_REQUIREMENT_ASSIGNMENTS = [
  { id: "demo-ra-1", code: "5.23.1.1", title: "تضمين البحث والتطوير والابتكار في استراتيجية التحول الرقمي", operationalStatus: "COMPLETED", workflowState: "APPROVED", ownerName: "مدير الاستراتيجية والابتكار", departmentName: DEMO_DEPT.nameAr },
  { id: "demo-ra-2", code: "5.23.1.2", title: "تحديد مبادرات ومشروعات الابتكار الرقمي", operationalStatus: "AWAITING_EVIDENCE", workflowState: "UNDER_REVIEW", ownerName: "محرر الابتكار الداخلي", departmentName: DEMO_DEPT.nameAr },
  { id: "demo-ra-3", code: "5.23.1.3", title: "التعاون مع جهات ومراكز ومختبرات الابتكار", operationalStatus: "IN_PROGRESS", workflowState: "DRAFT", ownerName: "إدارة الشراكات", departmentName: DEMO_DEPT.nameAr },
  { id: "demo-ra-4", code: "5.23.2.1", title: "الخطة السنوية للفعاليات الابتكارية", operationalStatus: "COMPLETED", workflowState: "COMPLETED", ownerName: "محرر الابتكار الداخلي", departmentName: DEMO_DEPT.nameAr },
  { id: "demo-ra-5", code: "5.23.3.1", title: "تشكيل لجنة الابتكار", operationalStatus: "IN_PROGRESS", workflowState: "SUBMITTED_FOR_REVIEW", ownerName: "مدير النظام", departmentName: DEMO_DEPT.nameAr },
].map((r) => ({
  ...r,
  // Superset shape: covers every nested path the real services destructure
  // (workspace-service.ts, live-readiness.ts, evidence-matrix-service.ts,
  // alerts/service.ts all `include`/`select` different subsets of this).
  departmentId: DEMO_DEPT.id,
  ownerUserId: "demo-admin",
  responsibleUserId: "demo-editor",
  dueDate: new Date(Date.now() + 5 * 86400000),
  updatedAt: new Date(),
  createdAt: new Date(),
  archivedAt: null,
  priority: "MEDIUM",
  nextAction: null,
  workspaceData: {},
  requirement: { id: `${r.id}-req`, code: r.code, titleAr: r.title, evidenceRules: [] },
  department: { id: DEMO_DEPT.id, nameAr: DEMO_DEPT.nameAr, organizationId: DEMO_ORG.id, organization: { id: DEMO_ORG.id, nameAr: DEMO_ORG.nameAr } },
  raciAssignments: [],
  tasks: [],
  workflowEvents: [],
  versions: [],
  collaboration: [],
}));

export const DEMO_SOLUTIONS = [
  { id: "demo-sol-1", nameAr: "مساعد ذكي لطلبات المستفيدين", maturityStage: "PILOT", implementationStatus: "IN_PROGRESS", owningDepartmentName: DEMO_DEPT.nameAr, beneficiaryCount: 1200, cost: 250000, ideaId: null, portfolioStatus: "IN_PROGRESS" },
  { id: "demo-sol-2", nameAr: "لوحة تحليل بيانات الخدمات الرقمية", maturityStage: "OPERATIONAL", implementationStatus: "OPERATING", owningDepartmentName: DEMO_DEPT.nameAr, beneficiaryCount: 4300, cost: 180000, ideaId: "demo-idea-accepted", portfolioStatus: "OPERATIONAL" },
].map((s) => ({
  ...s,
  description: null, problemStatement: null, source: "INTERNAL_PROPOSAL", ideaId: s.ideaId,
  owningDepartmentId: DEMO_DEPT.id, strategicObjectiveId: null, ownerUserId: "demo-editor",
  startDate: new Date(), targetEndDate: null, actualEndDate: null, durationMonths: 12,
  targetBeneficiaries: "المستفيدون من الخدمات الرقمية", technologies: "الذكاء الاصطناعي",
  completionPct: 60, evidenceReadinessPct: 40, risks: null, notes: null, status: "ACTIVE",
  publishedAt: null, createdAt: new Date(), updatedAt: new Date(), archivedAt: null,
  launchDate: null, beneficiarySatisfactionPct: null, achievedOrExpectedImpact: null,
  previouslySubmittedForMeasurement: false, significantChangeNote: null,
  innovationMethodologySource: null, digitalTransformationPlanLink: null,
  isSustained: true, sustainabilityOwner: "إدارة الابتكار والتحول الرقمي", sustainabilityPlan: "قياس الأثر ربع سنويًا ومراجعة مؤشرات الاستخدام.",
  portfolioStatus: s.portfolioStatus, externalReferenceId: null, intakeFingerprint: null,
  solutionType: "حل رقمي", domain: "الخدمات الحكومية", executingEntity: DEMO_DEPT.nameAr,
  operationalOwner: "محرر الابتكار الداخلي (Demo)", currentResponsibleUserId: "demo-editor", nextAction: "تحديث قياس الأثر وإرفاق دليل القياس", nextActionDueDate: new Date(Date.now() + 14 * 86400000),
  expectedImpact: "خفض زمن الوصول إلى الخدمة وتحسين تجربة المستفيد.", achievedImpact: s.id === "demo-sol-2" ? "تم تقليص وقت إعداد التقارير التشغيلية." : null,
  costReductionValue: s.id === "demo-sol-2" ? 45000 : null, costReductionPct: null, costReductionDescription: null,
  satisfactionMeasurementSource: null, satisfactionMeasurementDate: null, usageStartDate: new Date("2026-06-01"), stillInUse: true, usingDepartmentName: DEMO_DEPT.nameAr,
  operationNotes: null, methodologyApplicationId: null, sourceRecordType: s.ideaId ? "IDEA" : "INTERNAL_PROPOSAL", sourceRecordId: s.ideaId,
  sourceTraceability: {}, digitalTransformationObjective: "تحسين جودة الخدمات الرقمية", innovationObjective: "رفع كفاءة الخدمات", linkedInitiative: "برنامج تحسين تجربة المستفيد",
  beneficiaryGroups: ["المستفيدون", "موظفو مركز الاتصال"], technologyTags: ["أتمتة", "تحليل بيانات"], supportingArtifacts: [], implementationJourney: [], readinessDetails: {}, duplicateOfId: null, duplicateReason: null,
  owningDepartment: { nameAr: s.owningDepartmentName, organization: { nameAr: DEMO_ORG.nameAr } },
  impactIndicators: [],
  awards: [],
}));

// ── Solution/idea intake: showcase records only, with no write behaviour ──
export const DEMO_IDEAS = [
  { id: "demo-idea-review", titleAr: "مساعد افتراضي لتوجيه المستفيد", description: "اقتراح لمسار موحد يوجه المستفيد إلى الخدمة المناسبة.", category: "تحسين تجربة المستفيد", attachments: ["وصف الفكرة.pdf", "رسم أولي.png"], gate: 2, status: "INITIAL_REVIEW", submittedById: DEMO_INNOVATOR.id, departmentId: DEMO_DEPT.id },
  { id: "demo-idea-amendment", titleAr: "خدمة تنبيه استباقية للمواعيد", description: "إشعارات مخصصة للمستفيدين قبل المواعيد والخدمات المطلوبة.", category: "خدمات رقمية", attachments: ["دراسة أولية.pdf"], gate: 3, status: "MORE_INFO_REQUESTED", submittedById: DEMO_INNOVATOR.id, departmentId: DEMO_DEPT.id },
  { id: "demo-idea-accepted", titleAr: "لوحة تحليل بيانات الخدمات الرقمية", description: "حل تشغيلي مقبول ومحول إلى محفظة الحلول دون تكرار سجل.", category: "تحليل البيانات", attachments: ["نتائج التجربة.pdf", "دليل القياس.pdf"], gate: 7, status: "CONVERTED_TO_SOLUTION", submittedById: DEMO_INNOVATOR.id, departmentId: DEMO_DEPT.id },
].map((idea) => ({
  ...idea,
  activityId: null, createdAt: new Date("2026-08-20"), updatedAt: new Date(), archivedAt: null, archivedById: null,
  submittedBy: { id: DEMO_INNOVATOR.id, name: DEMO_INNOVATOR.name, email: DEMO_INNOVATOR.email },
  department: { id: DEMO_DEPT.id, nameAr: DEMO_DEPT.nameAr }, evaluations: [], decisions: [], infoRequests: [], solution: idea.id === "demo-idea-accepted" ? { id: "demo-sol-2", nameAr: "لوحة تحليل بيانات الخدمات الرقمية" } : null,
}));

/** Includes a clearly-labelled simulated AI first look; no AI is executed in DEMO_MODE. */
export const DEMO_IDEA_EVALUATIONS = [
  { id: "demo-eval-ai-1", ideaId: "demo-idea-review", evaluatorId: null, stage: "INITIAL", score: 76, notes: "تحليل مبدئي تجريبي: تتطلب الفكرة تحديد قناة الخدمة ومؤشر النجاح قبل الإحالة." },
  { id: "demo-eval-1", ideaId: "demo-idea-accepted", evaluatorId: "demo-editor", stage: "TECHNICAL", score: 88, notes: "التوصية: قبول التجربة وربطها بسجل الحل التشغيلي." },
].map((evaluation) => ({ ...evaluation, createdAt: new Date(), idea: DEMO_IDEAS.find((idea) => idea.id === evaluation.ideaId), evaluator: evaluation.evaluatorId ? { id: "demo-editor", name: "محرر الابتكار الداخلي (Demo)" } : { id: "demo-ai-preview", name: "تحليل مبدئي تجريبي" } }));

export const DEMO_IDEA_INFO_REQUESTS = [
  { id: "demo-info-1", ideaId: "demo-idea-amendment", requestedById: "demo-editor", requestedInfo: "يرجى إرفاق تقدير لعدد المستفيدين ووصف مختصر للأثر المتوقع.", requestedAt: new Date("2026-08-25"), responseText: null, respondedById: null, respondedAt: null, status: "OPEN" },
].map((request) => ({ ...request, idea: DEMO_IDEAS.find((idea) => idea.id === request.ideaId), createdAt: new Date(), updatedAt: new Date() }));

export const DEMO_IDEA_DECISIONS = [
  { id: "demo-decision-1", ideaId: "demo-idea-accepted", decidedById: "demo-admin", decision: "CONVERT_TO_SOLUTION", notes: "قُبلت الفكرة للتشغيل وأُدرجت في محفظة الحلول بنفس السجل المرتبط.", finalizedAt: new Date("2026-08-23"), finalizedById: "demo-admin" },
].map((decision) => ({ ...decision, supersedesId: null, correctionReason: null, reopenedAt: null, reopenedById: null, reopenReason: null, createdAt: new Date(), idea: DEMO_IDEAS.find((idea) => idea.id === decision.ideaId), decidedBy: { id: "demo-admin", name: "مدير النظام (Demo)" } }));

export const DEMO_SOLUTION_INTAKE_LINKS = [
  { id: "demo-intake-link-1", tokenHash: "demo-public-intake", tokenLast4: "2026", nameAr: "بوابة الابتكار العامة", purpose: "استقبال الأفكار والحلول من الموظفين والمستفيدين.", targetDepartmentId: DEMO_DEPT.id, ownerUserId: "demo-editor", startsAt: new Date("2026-01-01"), closesAt: null, isActive: true, instructions: "صف المشكلة والحل المقترح وأرفق ما يتوفر من أدلة.", archivedAt: null, createdAt: new Date(), updatedAt: new Date() },
];

export const DEMO_SOLUTION_INTAKE_SUBMISSIONS = [
  { id: "demo-intake-1", intakeLinkId: "demo-intake-link-1", solutionId: null, linkedSolutionId: null, sourceKind: "PUBLIC_LINK", submitterName: DEMO_INNOVATOR.name, submitterEmail: DEMO_INNOVATOR.email, departmentName: DEMO_INNOVATOR.departmentName, payload: { titleAr: "مساعد افتراضي لتوجيه المستفيد" }, fingerprint: "demo-intake-fingerprint-1", status: "SUBMITTED", reviewerUserId: "demo-editor", reviewerNotes: "بانتظار إتمام المراجعة الأولية.", amendmentDueDate: null, duplicateReason: null, continuationReason: null, submittedAt: new Date("2026-08-20"), reviewedAt: null },
  { id: "demo-intake-2", intakeLinkId: "demo-intake-link-1", solutionId: "demo-sol-2", linkedSolutionId: null, sourceKind: "PUBLIC_LINK", submitterName: DEMO_INNOVATOR.name, submitterEmail: DEMO_INNOVATOR.email, departmentName: DEMO_INNOVATOR.departmentName, payload: { titleAr: "لوحة تحليل بيانات الخدمات الرقمية" }, fingerprint: "demo-intake-fingerprint-2", status: "ACCEPTED", reviewerUserId: "demo-editor", reviewerNotes: "تم قبولها وإدراجها في المحفظة.", amendmentDueDate: null, duplicateReason: null, continuationReason: null, submittedAt: new Date("2026-08-10"), reviewedAt: new Date("2026-08-23") },
].map((submission) => ({ ...submission, importBatchKey: null, createdAt: new Date(), updatedAt: new Date(), intakeLink: DEMO_SOLUTION_INTAKE_LINKS[0], solution: submission.solutionId ? DEMO_SOLUTIONS.find((solution) => solution.id === submission.solutionId) : null }));

// ── Post-acceptance measurement fixtures for 5.24.2 showcase screens ─────
export const DEMO_SOLUTION_AWARDS = [
  { id: "demo-award-1", solutionId: "demo-sol-2", nameAr: "جائزة الابتكار الحكومي المحلية", level: "LOCAL", awardedAt: new Date("2026-07-12"), evidenceNote: "شهادة تقدير تجريبية", createdAt: new Date(), updatedAt: new Date(), archivedAt: null },
];

export const DEMO_IMPACT_INDICATORS = [
  { id: "demo-impact-1", solutionId: "demo-sol-2", nameAr: "زمن إعداد التقرير التشغيلي", type: "TIME_REDUCTION", unit: "دقيقة", baselineValue: 120, targetValue: 60, measurementMethod: "مقارنة زمن الإنجاز قبل وبعد الاستخدام" },
  { id: "demo-impact-2", solutionId: "demo-sol-2", nameAr: "رضا مستخدمي الخدمة", type: "SATISFACTION", unit: "%", baselineValue: 68, targetValue: 82, measurementMethod: "استبيان رضا المستفيد" },
].map((indicator) => ({ ...indicator, solution: DEMO_SOLUTIONS.find((solution) => solution.id === indicator.solutionId), createdAt: new Date(), updatedAt: new Date(), measurements: [] }));

export const DEMO_IMPACT_MEASUREMENTS = [
  { id: "demo-measurement-1", indicatorId: "demo-impact-1", actualValue: 54, periodStart: new Date("2026-07-01"), periodEnd: new Date("2026-07-31"), measuredAt: new Date("2026-08-01"), dataSource: "سجل تشغيل الخدمة", verificationStatus: "VERIFIED", notes: "أظهر القياس انخفاضًا فعليًا في زمن الإعداد.", verifiedAt: new Date("2026-08-02"), verifiedById: "demo-admin" },
  { id: "demo-measurement-2", indicatorId: "demo-impact-2", actualValue: null, periodStart: new Date("2026-08-01"), periodEnd: new Date("2026-08-31"), measuredAt: null, dataSource: "استبيان رضا المستفيد", verificationStatus: "PENDING", notes: "بانتظار إرفاق نتيجة القياس.", verifiedAt: null, verifiedById: null },
].map((measurement) => ({ ...measurement, supersedesId: null, reopenedAt: null, reopenedById: null, reopenReason: null, indicator: DEMO_IMPACT_INDICATORS.find((indicator) => indicator.id === measurement.indicatorId), createdAt: new Date(), updatedAt: new Date() }));

export const DEMO_EVIDENCE = [
  { id: "demo-evidence-1", nameAr: "استراتيجية التحول الرقمي المتضمنة للابتكار.pdf", requirementCode: "5.23.1.1", owner: "مدير الاستراتيجية والابتكار", reviewStatus: "معتمد", uploadedAt: "20 أغسطس 2026", source: "التوجه الاستراتيجي" },
  { id: "demo-evidence-2", nameAr: "محضر تفعيل اتفاقية التعاون.pdf", requirementCode: "5.23.1.3", owner: "محرر الابتكار الداخلي", reviewStatus: "يحتاج تعديل", uploadedAt: "24 أغسطس 2026", source: "التعاون والشراكات" },
  { id: "demo-evidence-3", nameAr: "دليل قياس أثر لوحة الخدمات.pdf", requirementCode: "5.24.2", owner: "محرر الابتكار الداخلي", reviewStatus: "قيد المراجعة", uploadedAt: "26 أغسطس 2026", source: "قياس أثر الحلول" },
];

export const DEMO_REPORTS = [
  { id: "demo-report-1", title: "التقرير التنفيذي للابتكار", scope: "ملخص المحفظة والجاهزية", updatedAt: "اليوم 10:30", status: "جاهز للعرض" },
  { id: "demo-report-2", title: "تقرير متابعة الأدلة", scope: "الأدلة المعتمدة والناقصة", updatedAt: "أمس", status: "يحتاج مراجعة" },
  { id: "demo-report-3", title: "تقرير أثر الحلول", scope: "القياسات المتحققة والمواعيد التالية", updatedAt: "25 أغسطس 2026", status: "جاهز للعرض" },
];

export const DEMO_LIFECYCLE = {
  validation: { status: "نجح الاختبار الأولي", result: "اختبر النموذج مع 18 مستفيدًا؛ 15 أكملوا المسار من المحاولة الأولى.", score: "83%" },
  incubation: { status: "قيد الاحتضان", mentor: "د. سارة العتيبي — مرشدة تجربة المستفيد", milestones: ["تحديد نطاق التجربة", "تطوير نموذج أولي", "اختبار المستخدمين", "عرض نتائج التجربة"] },
  ip: { status: "قيد إعداد الطلب", reference: "IP-DEMO-2026-014", owner: "فريق الابتكار والتحول الرقمي" },
  funding: { status: "بانتظار مراجعة اللجنة", reference: "FUND-DEMO-2026-008", amount: "180,000 ر.س", purpose: "تطوير التجربة التشغيلية وربطها بالخدمات الرقمية" },
};

export const DEMO_TASKS = [
  { id: "demo-task-1", title: "مراجعة بيانات 5.23.1.2 قبل الاعتماد", type: "REVIEW", status: "OPEN", priority: "HIGH", assignedToName: "مدير النظام (Demo)", assignedToUserId: "demo-admin", dueDate: new Date(Date.now() + 3 * 86400000), requestedById: "demo-editor", nextAction: "إتمام المراجعة", assignmentId: "demo-ra-2" },
  { id: "demo-task-2", title: "استكمال حقول اتفاقية التعاون 5.23.1.3", type: "PREPARE", status: "IN_PROGRESS", priority: "MEDIUM", assignedToName: "محرر الابتكار الداخلي (Demo)", assignedToUserId: "demo-editor", dueDate: new Date(Date.now() - 1 * 86400000), requestedById: "demo-admin", nextAction: "استكمال البيانات الناقصة", assignmentId: "demo-ra-3" },
].map((t, i) => ({
  ...t,
  createdAt: new Date(), updatedAt: new Date(),
  assignment: { id: t.assignmentId, requirement: { code: i === 0 ? "5.23.1.2" : "5.23.1.3", titleAr: i === 0 ? "تحديد مبادرات ومشروعات الابتكار الرقمي" : "التعاون مع جهات ومراكز ومختبرات الابتكار" }, department: { nameAr: DEMO_DEPT.nameAr } },
}));

export const DEMO_AUDIT_LOG = [
  { id: "demo-audit-1", action: "COMPLIANCE_ASSIGNMENT_UPDATED", actorName: "محرر الابتكار الداخلي (Demo)", summary: "تحديث بيانات مساحة عمل متطلب 5.23.1.2", createdAt: new Date(Date.now() - 2 * 3600000) },
  { id: "demo-audit-2", action: "EVIDENCE_UPLOADED", actorName: "محرر الابتكار الداخلي (Demo)", summary: "رفع إثبات لمتطلب 5.23.2.1", createdAt: new Date(Date.now() - 5 * 3600000) },
];
