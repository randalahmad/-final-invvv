import type { WorkspaceData } from "@/modules/dga/workspace-status";

export const REQUIREMENT_01_ID = "5-23-1-r1";
export const CONTRIBUTION_SECTIONS = ["innovationAreas", "strategicGoals", "kpis", "alignment"] as const;
export type ContributionSectionKey = (typeof CONTRIBUTION_SECTIONS)[number];

export const SECTION_LABELS: Record<ContributionSectionKey, string> = {
  innovationAreas: "مجالات الابتكار",
  strategicGoals: "الأهداف الاستراتيجية للبحث والابتكار",
  kpis: "المؤشرات KPIs",
  alignment: "المواءمة مع أهداف الجهة",
};

export interface ContributionView {
  id: string;
  sectionKey: ContributionSectionKey;
  contributorRole: "RESPONSIBLE" | "SUPPORTING";
  contributorUserId: string | null;
  contributorName: string;
  contributorEmail: string;
  jobTitle: string | null;
  departmentName: string | null;
  assignedByName: string;
  reviewerName: string | null;
  dueDate: string | null;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  requesterNote: string | null;
  status: string;
  invitationDelivery: string;
  assignedAt: string;
  invitationSentAt: string | null;
  openedAt: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  completedAt: string | null;
  latestSubmission: { version: number; data: WorkspaceData[string]; submittedAt: string; reviewNotes: string | null } | null;
}
