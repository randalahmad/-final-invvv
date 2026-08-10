export type DgaRequirementStatus = "NOT_STARTED" | "IN_PROGRESS" | "AWAITING_EVIDENCE" | "COMPLETED";

export interface DgaEvidenceDefinition {
  title: string;
  reviewStatus?: "NOT_REVIEWED" | "READY_FOR_REVIEW" | "HAS_NOTES" | "HUMAN_REVIEWED";
}

export interface DgaRequirementDefinition {
  id: string;
  number: string;
  title: string;
  applicationRequirement: string;
  tasks: readonly string[];
  evidence: readonly DgaEvidenceDefinition[];
  status: DgaRequirementStatus;
  owner: string;
  lastUpdate: string;
  notes?: string;
}

export interface DgaUnitDefinition {
  code: "5.23.1" | "5.23.2" | "5.23.3" | "5.24.1" | "5.24.2";
  slug: "strategy" | "methodologies" | "governance" | "solutions" | "impact";
  href: string;
  name: string;
  goal: string;
  readiness: number;
  missingEvidence: number;
  actionRequired: number;
  lastUpdate: string;
  requirements: readonly DgaRequirementDefinition[];
  productFields?: readonly string[];
  boundaryNote?: string;
}
