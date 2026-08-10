import { randomBytes } from "crypto";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

import {
  DEFAULT_ROLES,
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSIONS,
  ROLE_KEYS,
} from "../src/modules/auth/permissions";
import { REQUIREMENT_WORKSPACES } from "../src/modules/dga/workspace-config";

const prisma = new PrismaClient();

/**
 * Deterministic Phase-2A seed. Aligned with the aligned schema. Prepares data
 * for future testing; it does NOT implement the Phase 2B registration/auth flow.
 *
 * Credentials:
 *  - Admin password comes from SEED_ADMIN_PASSWORD (random-generated in production
 *    if unset). Demo (editor/partner/viewer) users use SEED_DEMO_PASSWORD or a
 *    clearly-marked local demo value; in production they are only seeded when
 *    SEED_DEMO_PASSWORD is explicitly provided. No real secret is ever committed.
 */
async function main() {
  const isProd = process.env.NODE_ENV === "production";

  // ---- 1) Permissions -----------------------------------------------------
  const permissionKeys = Object.values(PERMISSIONS);
  await Promise.all(
    permissionKeys.map((key) =>
      prisma.permission.upsert({
        where: { key },
        update: {},
        create: { key, nameAr: key },
      }),
    ),
  );
  const permissions = await prisma.permission.findMany();
  const permByKey = new Map(permissions.map((p) => [p.key, p.id]));

  // ---- 2) Roles + role→permission mapping ---------------------------------
  const roleIdByKey = new Map<string, string>();
  for (const role of DEFAULT_ROLES) {
    const created = await prisma.role.upsert({
      where: { key: role.key },
      update: { nameAr: role.nameAr, description: role.description, isSystem: true },
      create: { key: role.key, nameAr: role.nameAr, description: role.description, isSystem: true },
    });
    roleIdByKey.set(role.key, created.id);
    for (const permKey of DEFAULT_ROLE_PERMISSIONS[role.key]) {
      const permissionId = permByKey.get(permKey);
      if (!permissionId) continue;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: created.id, permissionId } },
        update: {},
        create: { roleId: created.id, permissionId },
      });
    }
  }

  // ---- 3) Owner org, two internal departments, one external partner -------
  const owner = await prisma.organization.upsert({
    where: { id: "org-owner" },
    update: {},
    create: {
      id: "org-owner",
      nameAr: "مدينة الملك عبدالله للطاقة الذرية والمتجددة",
      type: "OWNER",
    },
  });
  const deptDigital = await prisma.department.upsert({
    where: { id: "dept-digital" },
    update: {},
    create: { id: "dept-digital", organizationId: owner.id, nameAr: "إدارة التحول الرقمي" },
  });
  const deptStrategy = await prisma.department.upsert({
    where: { id: "dept-strategy" },
    update: {},
    create: { id: "dept-strategy", organizationId: owner.id, nameAr: "إدارة التخطيط الاستراتيجي" },
  });
  const partnerOrg = await prisma.organization.upsert({
    where: { id: "org-partner-uni" },
    update: {},
    create: { id: "org-partner-uni", nameAr: "جامعة الملك عبدالله للعلوم والتقنية", type: "UNIVERSITY" },
  });

  // ---- 4) Users (admin + three demo users) --------------------------------
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@innovation.local";
  let adminPassword = process.env.SEED_ADMIN_PASSWORD;
  let generatedAdminPassword = false;
  if (!adminPassword) {
    if (isProd) {
      adminPassword = randomBytes(12).toString("base64url");
      generatedAdminPassword = true;
    } else {
      adminPassword = "Admin@12345"; // local dev only
    }
  }

  // Demo users: only seeded in production when SEED_DEMO_PASSWORD is provided.
  const demoPassword = process.env.SEED_DEMO_PASSWORD ?? (isProd ? undefined : "Demo@12345");

  const adminHash = await bcrypt.hash(adminPassword, 10);
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      name: "مدير النظام",
      passwordHash: adminHash,
      status: "ACTIVE",
      registrationStatus: "APPROVED",
      jobTitle: "مدير منصة الابتكار المؤسسي",
    },
    create: {
      id: "user-admin",
      email: adminEmail,
      name: "مدير النظام",
      passwordHash: adminHash,
      status: "ACTIVE",
      registrationStatus: "APPROVED",
      jobTitle: "مدير منصة الابتكار المؤسسي",
    },
  });

  // Assign the platform-scoped SYSTEM_ADMIN role (upsert by fixed id).
  const adminRoleId = roleIdByKey.get(ROLE_KEYS.SYSTEM_ADMIN)!;
  await prisma.userRole.upsert({
    where: { id: "ur-admin-platform" },
    update: { userId: admin.id, roleId: adminRoleId, scopeType: "PLATFORM", scopeId: null },
    create: { id: "ur-admin-platform", userId: admin.id, roleId: adminRoleId, scopeType: "PLATFORM", scopeId: null },
  });

  // Helper to seed a demo user + membership + scoped role assignment.
  async function seedDemoUser(opts: {
    id: string;
    email: string;
    name: string;
    jobTitle: string;
    roleKey: string;
    scopeType: "PLATFORM" | "ORGANIZATION" | "DEPARTMENT" | "AGREEMENT" | "SOLUTION" | "PUBLISHED";
    scopeId: string | null;
    membership?: { organizationId?: string; departmentId?: string };
  }) {
    if (!demoPassword) return null; // skip demo users in prod without an explicit demo password
    const hash = await bcrypt.hash(demoPassword, 10);
    const user = await prisma.user.upsert({
      where: { email: opts.email },
      update: {
        name: opts.name,
        passwordHash: hash,
        status: "ACTIVE",
        registrationStatus: "APPROVED",
        requestedRoleKey: opts.roleKey,
        approvedById: admin.id,
        approvedAt: new Date(),
        jobTitle: opts.jobTitle,
      },
      create: {
        id: opts.id,
        email: opts.email,
        name: opts.name,
        passwordHash: hash,
        status: "ACTIVE",
        registrationStatus: "APPROVED",
        requestedRoleKey: opts.roleKey,
        approvedById: admin.id,
        approvedAt: new Date(),
        jobTitle: opts.jobTitle,
      },
    });
    await prisma.userRole.upsert({
      where: { id: `ur-${opts.id}` },
      update: {
        userId: user.id,
        roleId: roleIdByKey.get(opts.roleKey)!,
        scopeType: opts.scopeType,
        scopeId: opts.scopeId,
      },
      create: {
        id: `ur-${opts.id}`,
        userId: user.id,
        roleId: roleIdByKey.get(opts.roleKey)!,
        scopeType: opts.scopeType,
        scopeId: opts.scopeId,
      },
    });
    if (opts.membership) {
      await prisma.userMembership.upsert({
        where: { id: `mem-${opts.id}` },
        update: {
          userId: user.id,
          organizationId: opts.membership.organizationId ?? null,
          departmentId: opts.membership.departmentId ?? null,
        },
        create: {
          id: `mem-${opts.id}`,
          userId: user.id,
          organizationId: opts.membership.organizationId ?? null,
          departmentId: opts.membership.departmentId ?? null,
        },
      });
    }
    return user;
  }

  const editor = await seedDemoUser({
    id: "user-editor",
    email: "editor@innovation.local",
    name: "محرر إدارة التحول الرقمي",
    jobTitle: "محرر داخلي",
    roleKey: ROLE_KEYS.INTERNAL_EDITOR,
    scopeType: "DEPARTMENT",
    scopeId: deptDigital.id,
    membership: { organizationId: owner.id, departmentId: deptDigital.id },
  });
  const partnerUser = await seedDemoUser({
    id: "user-partner",
    email: "partner@innovation.local",
    name: "منسّق الشراكة الجامعية",
    jobTitle: "شريك خارجي",
    roleKey: ROLE_KEYS.EXTERNAL_PARTNER,
    scopeType: "SOLUTION",
    scopeId: "sol-seed",
    membership: { organizationId: partnerOrg.id },
  });
  await seedDemoUser({
    id: "user-viewer",
    email: "viewer@innovation.local",
    name: "مطّلع قيادي",
    jobTitle: "مطّلع",
    roleKey: ROLE_KEYS.VIEWER,
    scopeType: "PUBLISHED",
    scopeId: null,
    membership: { organizationId: owner.id },
  });

  const editorId = editor?.id ?? admin.id; // fall back to admin when demo users are skipped

  // ---- 5) Strategy: one objective -----------------------------------------
  const objective = await prisma.strategicObjective.upsert({
    where: { id: "obj-seed" },
    update: {},
    create: {
      id: "obj-seed",
      code: "SO-1",
      titleAr: "رفع كفاءة التشغيل عبر الابتكار الرقمي",
      description: "هدف استراتيجي تجريبي للبذرة",
      departmentId: deptStrategy.id,
      responsibleUserId: admin.id,
      status: "ACTIVE",
    },
  });

  // ---- 6) Activity: one activity ------------------------------------------
  const activity = await prisma.innovationActivity.upsert({
    where: { id: "act-seed" },
    update: {},
    create: {
      id: "act-seed",
      nameAr: "هاكاثون الابتكار المؤسسي",
      type: "HACKATHON",
      challenge: "تحسين موثوقية الأصول التشغيلية",
      organizerDepartmentId: deptDigital.id,
      status: "COMPLETED",
    },
  });

  // ---- 7) Governance: one idea --------------------------------------------
  const idea = await prisma.idea.upsert({
    where: { id: "idea-seed" },
    update: {},
    create: {
      id: "idea-seed",
      titleAr: "نظام تنبيهات الصيانة الاستباقية",
      description: "فكرة تجريبية للبذرة",
      activityId: activity.id,
      submittedById: editorId,
      departmentId: deptDigital.id,
      status: "SUBMITTED",
    },
  });

  // ---- 8) Solutions registry: one solution (linked from the idea) ---------
  const solution = await prisma.innovationSolution.upsert({
    where: { id: "sol-seed" },
    update: {
      nameAr: "منصة الصيانة الاستباقية للأصول",
      description:
        "حل ابتكاري لتحليل بيانات الأصول التشغيلية ودعم فرق الصيانة في اكتشاف مؤشرات الأعطال مبكرًا.",
      problemStatement: "تؤدي الصيانة التفاعلية بعد وقوع الأعطال إلى توقفات تشغيلية غير مخططة وارتفاع تكلفة المعالجة.",
      source: "ACTIVITY",
      activityId: activity.id,
      ideaId: idea.id,
      owningDepartmentId: deptDigital.id,
      strategicObjectiveId: objective.id,
      ownerUserId: editorId,
      maturityStage: "PILOT",
      implementationStatus: "IN_PROGRESS",
      targetBeneficiaries: "فرق التشغيل والصيانة وإدارة الأصول",
      durationMonths: 10,
      cost: "27000.00",
      completionPct: 60,
      status: "ACTIVE",
    },
    create: {
      id: "sol-seed",
      nameAr: "منصة الصيانة الاستباقية للأصول",
      description:
        "حل ابتكاري لتحليل بيانات الأصول التشغيلية ودعم فرق الصيانة في اكتشاف مؤشرات الأعطال مبكرًا.",
      problemStatement: "تؤدي الصيانة التفاعلية بعد وقوع الأعطال إلى توقفات تشغيلية غير مخططة وارتفاع تكلفة المعالجة.",
      source: "ACTIVITY",
      activityId: activity.id,
      ideaId: idea.id,
      owningDepartmentId: deptDigital.id,
      strategicObjectiveId: objective.id,
      ownerUserId: editorId,
      maturityStage: "PILOT",
      implementationStatus: "IN_PROGRESS",
      targetBeneficiaries: "فرق التشغيل والصيانة وإدارة الأصول",
      durationMonths: 10,
      cost: "27000.00",
      completionPct: 60,
      evidenceReadinessPct: 0,
      status: "ACTIVE",
    },
  });

  const supportingSolutions = [
    {
      id: "sol-demo-energy",
      nameAr: "نظام متابعة كفاءة استهلاك الطاقة",
      description:
        "لوحة تشغيلية تجمع مؤشرات استهلاك الطاقة من المرافق وتدعم مقارنة الأداء واكتشاف فرص التحسين.",
      problemStatement:
        "تتوزع بيانات استهلاك الطاقة بين مصادر متعددة، مما يؤخر اكتشاف الانحرافات ويحد من القدرة على قياس أثر مبادرات الكفاءة.",
      maturityStage: "POC" as const,
      implementationStatus: "IN_PROGRESS" as const,
      targetBeneficiaries: "فرق كفاءة الطاقة والتشغيل والاستدامة",
      completionPct: 45,
    },
    {
      id: "sol-demo-ideas",
      nameAr: "بوابة إدارة المقترحات الابتكارية",
      description:
        "قناة مؤسسية موحدة لاستقبال المقترحات وفرزها ومتابعة قرارات التقييم وربط المقبول منها بسجل الحلول.",
      problemStatement:
        "تصل المقترحات الابتكارية عبر قنوات متفرقة دون سجل موحد يوضح الملكية وحالة التقييم والقرارات المتخذة.",
      maturityStage: "CONCEPT" as const,
      implementationStatus: "PLANNING" as const,
      targetBeneficiaries: null,
      completionPct: 25,
    },
  ];

  for (const item of supportingSolutions) {
    await prisma.innovationSolution.upsert({
      where: { id: item.id },
      update: {
        nameAr: item.nameAr,
        description: item.description,
        problemStatement: item.problemStatement,
        source: "INTERNAL_PROPOSAL",
        owningDepartmentId: deptDigital.id,
        strategicObjectiveId: objective.id,
        ownerUserId: editorId,
        maturityStage: item.maturityStage,
        implementationStatus: item.implementationStatus,
        targetBeneficiaries: item.targetBeneficiaries,
        completionPct: item.completionPct,
        status: "ACTIVE",
      },
      create: {
        id: item.id,
        nameAr: item.nameAr,
        description: item.description,
        problemStatement: item.problemStatement,
        source: "INTERNAL_PROPOSAL",
        owningDepartmentId: deptDigital.id,
        strategicObjectiveId: objective.id,
        ownerUserId: editorId,
        maturityStage: item.maturityStage,
        implementationStatus: item.implementationStatus,
        targetBeneficiaries: item.targetBeneficiaries,
        completionPct: item.completionPct,
        evidenceReadinessPct: 0,
        status: "ACTIVE",
      },
    });
  }

  // ---- 9) Impact: one indicator -------------------------------------------
  await prisma.impactIndicator.upsert({
    where: { id: "imp-seed" },
    update: {},
    create: {
      id: "imp-seed",
      solutionId: solution.id,
      nameAr: "نسبة تقليل زمن التوقف غير المخطط",
      type: "OPERATIONAL",
      unit: "%",
      baselineValue: "100.0000",
      targetValue: "70.0000",
      measurementMethod: "مقارنة أرباع سنوية",
    },
  });

  // ---- 10) Partners: one agreement + one meeting --------------------------
  const agreement = await prisma.cooperationAgreement.upsert({
    where: { id: "agr-seed" },
    update: {},
    create: {
      id: "agr-seed",
      partnerOrgId: partnerOrg.id,
      titleAr: "مذكرة تعاون بحثي",
      type: "RESEARCH",
      responsibleUserId: admin.id,
      renewalStatus: "NOT_DUE",
      status: "ACTIVE",
      meetingFrequencyMonths: 3,
    },
  });
  await prisma.agreementMeeting.upsert({
    where: { id: "mtg-seed" },
    update: {},
    create: { id: "mtg-seed", agreementId: agreement.id, status: "SCHEDULED" },
  });

  // ---- 11) Explicit share: partner ← solution (allow-listed) --------------
  if (partnerUser) {
    await prisma.resourceShare.upsert({
      where: { id: "share-seed" },
      update: {},
      create: {
        id: "share-seed",
        userId: partnerUser.id,
        entityType: "INNOVATION_SOLUTION",
        solutionId: solution.id,
        allowedActions: ["upload_evidence", "update_contact"],
        allowedFields: ["notes"],
        grantedById: admin.id,
      },
    });
  }

  // ---- 12) Compliance: sections + requirements (+ example rules) ----------
  const sections = [
    { id: "sec-5-23", code: "5.23", titleAr: "الابتكار المؤسسي", sectionWeight: 1, orderIndex: 1 },
    { id: "sec-5-24", code: "5.24", titleAr: "الحلول الابتكارية", sectionWeight: 1, orderIndex: 2 },
  ];
  const sectionIdByCode = new Map<string, string>();
  for (const s of sections) {
    const created = await prisma.complianceSection.upsert({
      where: { code: s.code },
      update: { titleAr: s.titleAr, sectionWeight: s.sectionWeight, orderIndex: s.orderIndex, isActive: true },
      create: { ...s, isActive: true },
    });
    sectionIdByCode.set(s.code, created.id);
  }

  const requirements = [
    { code: "5.23.1", sectionCode: "5.23", titleAr: "التوجه الاستراتيجي" },
    { code: "5.23.2", sectionCode: "5.23", titleAr: "منهجيات الابتكار وفعالياته" },
    { code: "5.23.3", sectionCode: "5.23", titleAr: "حوكمة الابتكار" },
    { code: "5.24.1", sectionCode: "5.24", titleAr: "حصر الحلول الابتكارية" },
    { code: "5.24.2", sectionCode: "5.24", titleAr: "قياس أثر الحلول" },
  ];
  for (const r of requirements) {
    // 5.24.x requirements inspect a solution and permit governed N/A on 5.24.2
    // (impact-dependent); the rest keep the defaults. allowNA is DATA, not code.
    const allowNA = r.code === "5.24.2";
    await prisma.complianceRequirement.upsert({
      where: { code: r.code },
      update: {
        titleAr: r.titleAr,
        sectionCode: r.sectionCode,
        sectionId: sectionIdByCode.get(r.sectionCode),
        entityType: r.code.startsWith("5.24") ? "INNOVATION_SOLUTION" : null,
        allowNA,
        isActive: true,
      },
      create: {
        code: r.code,
        titleAr: r.titleAr,
        sectionCode: r.sectionCode,
        sectionId: sectionIdByCode.get(r.sectionCode),
        entityType: r.code.startsWith("5.24") ? "INNOVATION_SOLUTION" : null,
        allowNA,
        isActive: true,
        version: 1,
      },
    });
  }

  // Phase 2: operational application requirements under the three 5.23 units.
  // Upserts keep this safe to run repeatedly and preserve any saved workspace data.
  for (const workspace of REQUIREMENT_WORKSPACES) {
    const unitCode = workspace.code.split(".").slice(0, 3).join(".");
    const parent = await prisma.complianceRequirement.findUnique({ where: { code: unitCode } });
    if (!parent) continue;
    const definition = workspace.sections.map((section) => section.title).join("، ");
    const child = await prisma.complianceRequirement.upsert({
      where: { code: workspace.code },
      update: { titleAr: workspace.explanation, description: definition, parentId: parent.id, sectionId: parent.sectionId, sectionCode: parent.sectionCode, isActive: true },
      create: { code: workspace.code, titleAr: workspace.explanation, description: definition, parentId: parent.id, sectionId: parent.sectionId, sectionCode: parent.sectionCode, isActive: true, isEstimated: false },
    });
    let order = 0;
    for (const section of workspace.sections) for (const field of section.fields) {
      await prisma.requirementFieldRule.upsert({
        where: { requirementId_fieldKey: { requirementId: child.id, fieldKey: `${section.key}.${field.key}` } },
        update: { labelAr: field.label, rule: section.repeatable ? `required;repeatable;minItems:${section.minItems ?? 1}` : "required", optional: field.required === false, orderIndex: order++ },
        create: { requirementId: child.id, fieldKey: `${section.key}.${field.key}`, labelAr: field.label, rule: section.repeatable ? `required;repeatable;minItems:${section.minItems ?? 1}` : "required", optional: field.required === false, orderIndex: order++ },
      });
    }
    for (const rule of workspace.evidence) await prisma.requirementEvidenceRule.upsert({
      where: { requirementId_evidenceTypeKey: { requirementId: child.id, evidenceTypeKey: rule.key } },
      update: { labelAr: rule.title, minCount: rule.minCount, mandatoryGate: true },
      create: { requirementId: child.id, evidenceTypeKey: rule.key, labelAr: rule.title, minCount: rule.minCount, mandatoryGate: true },
    });
    const existingAssignment = await prisma.complianceRequirementAssignment.findFirst({ where: { complianceRequirementId: child.id, departmentId: deptStrategy.id, archivedAt: null } });
    if (!existingAssignment) await prisma.complianceRequirementAssignment.create({ data: { complianceRequirementId: child.id, departmentId: deptStrategy.id, assignedById: admin.id, responsibleUserId: editor?.id ?? admin.id } });
  }

  // Example scoring config (demonstrates configurable weights/gates/optional
  // criteria — NOT hard-coded scoring logic). The Phase 6 engine reads these.
  async function fieldRule(requirementId: string, fieldKey: string, data: { labelAr: string; rule?: string; weight?: number; mandatoryGate?: boolean; optional?: boolean }) {
    await prisma.requirementFieldRule.upsert({
      where: { requirementId_fieldKey: { requirementId, fieldKey } },
      update: { labelAr: data.labelAr, rule: data.rule ?? "required", weight: data.weight ?? 1, mandatoryGate: data.mandatoryGate ?? false, optional: data.optional ?? false },
      create: { requirementId, fieldKey, labelAr: data.labelAr, rule: data.rule ?? "required", weight: data.weight ?? 1, mandatoryGate: data.mandatoryGate ?? false, optional: data.optional ?? false },
    });
  }
  async function evidenceRule(requirementId: string, evidenceTypeKey: string, data: { labelAr: string; minCount?: number; weight?: number; mandatoryGate?: boolean }) {
    await prisma.requirementEvidenceRule.upsert({
      where: { requirementId_evidenceTypeKey: { requirementId, evidenceTypeKey } },
      update: { labelAr: data.labelAr, minCount: data.minCount ?? 1, weight: data.weight ?? 1, mandatoryGate: data.mandatoryGate ?? false },
      create: { requirementId, evidenceTypeKey, labelAr: data.labelAr, minCount: data.minCount ?? 1, weight: data.weight ?? 1, mandatoryGate: data.mandatoryGate ?? false },
    });
  }

  const req5241 = await prisma.complianceRequirement.findUnique({ where: { code: "5.24.1" } });
  if (req5241) {
    await fieldRule(req5241.id, "strategicObjectiveId", { labelAr: "الهدف الاستراتيجي", weight: 2, mandatoryGate: true });
    await fieldRule(req5241.id, "owningDepartmentId", { labelAr: "الإدارة المالكة", weight: 1, mandatoryGate: true });
    await fieldRule(req5241.id, "problemStatement", { labelAr: "وصف المشكلة", rule: "minLength:40", weight: 1 });
    await fieldRule(req5241.id, "notes", { labelAr: "ملاحظات إضافية", rule: "optional", weight: 0, optional: true });
    await evidenceRule(req5241.id, "APPROVAL_MEMO", { labelAr: "محضر اعتماد", minCount: 1, weight: 2, mandatoryGate: true });
  }
  const req5242 = await prisma.complianceRequirement.findUnique({ where: { code: "5.24.2" } });
  if (req5242) {
    await fieldRule(req5242.id, "targetBeneficiaries", { labelAr: "الفئة المستفيدة", weight: 1 });
    await evidenceRule(req5242.id, "IMPACT_REPORT", { labelAr: "تقرير الأثر", minCount: 1, weight: 2 });
  }

  // ---- 13) Stakeholder demo evidence + completed analysis -----------------
  // These records are deterministic and metadata-only. For a live upload and
  // extraction demo, upload a supported file through the running application
  // so the configured storage provider owns the binary.
  if (req5241 && req5242) {
    const approvedEvidence = await prisma.evidence.upsert({
      where: { id: "evidence-demo-approved" },
      update: {
        title: "محضر اعتماد تجربة الصيانة الاستباقية",
        classification: "APPROVAL_MEMO",
        uploadedById: editorId,
        notes: "سجل عرض معتمد يوضح أن الجاهزية تحتسب الأدلة المعتمدة بشريًا فقط.",
      },
      create: {
        id: "evidence-demo-approved",
        title: "محضر اعتماد تجربة الصيانة الاستباقية",
        classification: "APPROVAL_MEMO",
        fileName: "محضر-اعتماد-تجربة-الصيانة.pdf",
        mimeType: "application/pdf",
        fileProcessingStatus: "EXTRACTION_READY",
        reviewStatus: "APPROVED",
        verificationStatus: "VERIFIED",
        uploadedById: editorId,
        reviewedById: admin.id,
        reviewedAt: new Date("2026-06-18T09:00:00.000Z"),
        approvedById: admin.id,
        approvedAt: new Date("2026-06-18T09:15:00.000Z"),
        notes: "سجل عرض معتمد يوضح أن الجاهزية تحتسب الأدلة المعتمدة بشريًا فقط.",
      },
    });

    const analyzedEvidence = await prisma.evidence.upsert({
      where: { id: "evidence-demo-analysis" },
      update: {
        title: "تقرير قياس أثر التجربة - بانتظار المراجعة",
        uploadedById: editorId,
        notes: "نتيجة تحليل مكتملة للعرض؛ الاقتراحات لا تعدّل السجل الرسمي قبل قرار المراجع.",
      },
      create: {
        id: "evidence-demo-analysis",
        title: "تقرير قياس أثر التجربة - بانتظار المراجعة",
        fileName: "تقرير-قياس-أثر-التجربة.pdf",
        mimeType: "application/pdf",
        fileProcessingStatus: "EXTRACTION_READY",
        reviewStatus: "DRAFT",
        verificationStatus: "UNVERIFIED",
        uploadedById: editorId,
        notes: "نتيجة تحليل مكتملة للعرض؛ الاقتراحات لا تعدّل السجل الرسمي قبل قرار المراجع.",
      },
    });

    for (const evidence of [approvedEvidence, analyzedEvidence]) {
      await prisma.evidenceLink.upsert({
        where: {
          evidenceId_entityType_entityId: {
            evidenceId: evidence.id,
            entityType: "INNOVATION_SOLUTION",
            entityId: solution.id,
          },
        },
        update: {},
        create: {
          evidenceId: evidence.id,
          entityType: "INNOVATION_SOLUTION",
          entityId: solution.id,
        },
      });
    }
    await prisma.evidenceLink.upsert({
      where: {
        evidenceId_entityType_entityId: {
          evidenceId: approvedEvidence.id,
          entityType: "COMPLIANCE_REQUIREMENT",
          entityId: req5241.id,
        },
      },
      update: { requirementId: req5241.id },
      create: {
        evidenceId: approvedEvidence.id,
        entityType: "COMPLIANCE_REQUIREMENT",
        entityId: req5241.id,
        requirementId: req5241.id,
      },
    });

    const analysis = await prisma.documentAnalysis.upsert({
      where: { evidenceId: analyzedEvidence.id },
      update: {
        format: "PDF",
        status: "COMPLETED",
        provider: "heuristic",
        model: "rules-1.0.0",
        extractorVersion: "local-1.0.0",
        promptVersion: "n/a",
        startedAt: new Date("2026-07-20T08:30:00.000Z"),
        completedAt: new Date("2026-07-20T08:30:04.000Z"),
        failedAt: null,
        error: null,
        extractedTextMeta: { pages: 4, textCoverage: 0.96 },
        sourceRefs: { document: "تقرير قياس أثر التجربة", pages: [1, 2, 3, 4] },
      },
      create: {
        id: "analysis-demo-impact",
        evidenceId: analyzedEvidence.id,
        format: "PDF",
        status: "COMPLETED",
        provider: "heuristic",
        model: "rules-1.0.0",
        extractorVersion: "local-1.0.0",
        promptVersion: "n/a",
        startedAt: new Date("2026-07-20T08:30:00.000Z"),
        completedAt: new Date("2026-07-20T08:30:04.000Z"),
        extractedTextMeta: { pages: 4, textCoverage: 0.96 },
        sourceRefs: { document: "تقرير قياس أثر التجربة", pages: [1, 2, 3, 4] },
      },
    });

    const demoSuggestions = [
      {
        id: "suggestion-demo-classification",
        kind: "FIELD" as const,
        fieldKey: "classification",
        suggestedValue: "IMPACT_REPORT",
        confidence: 0.94,
        sourcePage: 1,
        sourceSection: "ملخص التقرير",
        sourceExcerpt: "تقرير قياس أثر تجربة الصيانة الاستباقية للأصول التشغيلية",
      },
      {
        id: "suggestion-demo-requirement",
        kind: "REQUIREMENT_MAP" as const,
        fieldKey: null,
        suggestedRequirementId: req5242.id,
        targetEntityType: "COMPLIANCE_REQUIREMENT" as const,
        targetEntityId: req5242.id,
        confidence: 0.91,
        sourcePage: 2,
        sourceSection: "مؤشرات الأثر التشغيلي",
        sourceExcerpt: "انخفاض زمن التوقف غير المخطط خلال فترة التجربة",
      },
    ];
    for (const suggestion of demoSuggestions) {
      const { id, ...suggestionData } = suggestion;
      await prisma.analysisSuggestion.upsert({
        where: { id },
        update: {
          analysisId: analysis.id,
          ...suggestionData,
        },
        create: {
          id,
          analysisId: analysis.id,
          ...suggestionData,
          reviewOutcome: "PENDING",
        },
      });
    }
  }

  console.log(`Seed complete. Admin email: ${adminEmail}`);
  if (generatedAdminPassword) {
    console.log(`Generated admin password (SAVE THIS NOW, shown once): ${adminPassword}`);
  } else if (!isProd) {
    console.log(`Admin password (dev): ${adminPassword}`);
    console.log(`Demo users (dev) password: ${demoPassword} — editor@ / partner@ / viewer@innovation.local`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
