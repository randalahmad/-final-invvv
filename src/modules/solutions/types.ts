/** View-layer types for the innovation solutions registry (shell phase). */

export type MaturityStageLabel =
  | "مفهوم"
  | "نموذج أولي (Prototype)"
  | "إثبات مفهوم (PoC)"
  | "نسخة تجريبية"
  | "تشغيل فعلي";

export type GovernanceColumn = "قيد المراجعة الفنية" | "احتضان فوري (Pilot)" | "مكتملة";

export type SolutionSourceLabel = "هاكاثون المعسكر" | "مقترح داخلي" | "شراكة خارجية";

export interface SolutionRecord {
  id: string;
  name: string;
  maturityStage: MaturityStageLabel;
  governanceColumn: GovernanceColumn;
  owner: string;
  source: SolutionSourceLabel;
  readinessPct: number;
  problem: string;
  durationLabel: string;
  costLabel: string;
  audience: string;
  strategicGoal: string;
}

export const MATURITY_STAGES: MaturityStageLabel[] = [
  "مفهوم",
  "نموذج أولي (Prototype)",
  "إثبات مفهوم (PoC)",
  "نسخة تجريبية",
  "تشغيل فعلي",
];

export const GOVERNANCE_COLUMNS: GovernanceColumn[] = [
  "قيد المراجعة الفنية",
  "احتضان فوري (Pilot)",
  "مكتملة",
];
