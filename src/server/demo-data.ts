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
  requirement: {
    id: `${r.id}-req`,
    code: r.code,
    titleAr: r.title,
    evidenceRules: [{
      evidenceTypeKey: {
        "5.23.1.1": "DIGITAL_STRATEGY",
        "5.23.1.2": "INITIATIVE_KPI_DOCUMENTS",
        "5.23.1.3": "COOPERATION_AGREEMENT",
        "5.23.2.1": "ANNUAL_INNOVATION_PLAN",
        "5.23.3.1": "COMMITTEE_STRUCTURE",
      }[r.code]!,
      minCount: 1,
    }],
  },
  department: { id: DEMO_DEPT.id, nameAr: DEMO_DEPT.nameAr, organizationId: DEMO_ORG.id, organization: { id: DEMO_ORG.id, nameAr: DEMO_ORG.nameAr } },
  raciAssignments: [],
  tasks: [],
  workflowEvents: [],
  versions: [],
  collaboration: [],
}));

/**
 * Superset shape for every nested EvidenceLink/Evidence path read by the
 * evidence matrix, readiness and alerts services. These are intentionally
 * linked to only part of the five requirement assignments: preview users see
 * approved, in-review and genuinely missing evidence rather than a cosmetic
 * all-complete state.
 */
export const DEMO_EVIDENCE_LINKS = [
  {
    id: "demo-evidence-link-1",
    evidenceId: "demo-evidence-1",
    entityType: "REQUIREMENT_ASSIGNMENT",
    entityId: "demo-ra-1",
    requirementId: "demo-ra-1-req",
    createdAt: new Date(Date.now() - 7 * 86400000),
    evidence: {
      id: "demo-evidence-1",
      title: "استراتيجية التحول الرقمي المعتمدة",
      classification: "DIGITAL_STRATEGY",
      fileName: "digital-transformation-strategy.pdf",
      version: 2,
      ownerUserId: "demo-admin",
      uploadedById: "demo-admin",
      uploadedBy: { name: "مدير النظام (Demo)" },
      createdAt: new Date(Date.now() - 7 * 86400000),
      updatedAt: new Date(Date.now() - 2 * 86400000),
      archivedAt: null,
      reviewStatus: "APPROVED",
      approvedAt: new Date(Date.now() - 2 * 86400000),
      validUntil: new Date(Date.now() + 180 * 86400000),
    },
  },
  {
    id: "demo-evidence-link-2",
    evidenceId: "demo-evidence-2",
    entityType: "REQUIREMENT_ASSIGNMENT",
    entityId: "demo-ra-2",
    requirementId: "demo-ra-2-req",
    createdAt: new Date(Date.now() - 2 * 86400000),
    evidence: {
      id: "demo-evidence-2",
      title: "وثائق مبادرات ومؤشرات الأداء",
      classification: "INITIATIVE_KPI_DOCUMENTS",
      fileName: "innovation-initiatives-kpis.xlsx",
      version: 1,
      ownerUserId: "demo-editor",
      uploadedById: "demo-editor",
      uploadedBy: { name: "محرر الابتكار الداخلي (Demo)" },
      createdAt: new Date(Date.now() - 2 * 86400000),
      updatedAt: new Date(Date.now() - 2 * 86400000),
      archivedAt: null,
      reviewStatus: "UNDER_REVIEW",
      approvedAt: null,
      validUntil: null,
    },
  },
  {
    id: "demo-evidence-link-3",
    evidenceId: "demo-evidence-3",
    entityType: "REQUIREMENT_ASSIGNMENT",
    entityId: "demo-ra-4",
    requirementId: "demo-ra-4-req",
    createdAt: new Date(Date.now() - 12 * 86400000),
    evidence: {
      id: "demo-evidence-3",
      title: "الخطة السنوية للفعاليات الابتكارية",
      classification: "ANNUAL_INNOVATION_PLAN",
      fileName: "annual-innovation-activities-plan.pdf",
      version: 3,
      ownerUserId: "demo-editor",
      uploadedById: "demo-editor",
      uploadedBy: { name: "محرر الابتكار الداخلي (Demo)" },
      createdAt: new Date(Date.now() - 12 * 86400000),
      updatedAt: new Date(Date.now() - 1 * 86400000),
      archivedAt: null,
      reviewStatus: "NEEDS_UPDATE",
      approvedAt: null,
      validUntil: new Date(Date.now() - 1 * 86400000),
    },
  },
];

export const DEMO_SOLUTIONS = [
  { id: "demo-sol-1", nameAr: "مساعد ذكي لطلبات المستفيدين", maturityStage: "PILOT", implementationStatus: "IN_PROGRESS", owningDepartmentName: DEMO_DEPT.nameAr, beneficiaryCount: 1200, cost: 250000 },
  { id: "demo-sol-2", nameAr: "لوحة تحليل بيانات الخدمات الرقمية", maturityStage: "OPERATIONAL", implementationStatus: "OPERATING", owningDepartmentName: DEMO_DEPT.nameAr, beneficiaryCount: 4300, cost: 180000 },
].map((s) => ({
  ...s,
  description: null, problemStatement: null, source: "INTERNAL_PROPOSAL",
  owningDepartmentId: DEMO_DEPT.id, strategicObjectiveId: null, ownerUserId: "demo-editor",
  startDate: new Date(), targetEndDate: null, actualEndDate: null, durationMonths: 12,
  targetBeneficiaries: "المستفيدون من الخدمات الرقمية", technologies: "الذكاء الاصطناعي",
  completionPct: 60, evidenceReadinessPct: 40, risks: null, notes: null, status: "ACTIVE",
  publishedAt: null, createdAt: new Date(), updatedAt: new Date(), archivedAt: null,
  launchDate: null, beneficiarySatisfactionPct: null, achievedOrExpectedImpact: null,
  previouslySubmittedForMeasurement: false, significantChangeNote: null,
  innovationMethodologySource: null, digitalTransformationPlanLink: null,
  isSustained: null, sustainabilityOwner: null, sustainabilityPlan: null,
  owningDepartment: { nameAr: s.owningDepartmentName, organization: { nameAr: DEMO_ORG.nameAr } },
  impactIndicators: [],
  awards: [],
}));

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
