export type AlertSeverityLabel = "urgent" | "reminder";

export interface AlertItemData {
  id: string;
  title: string;
  detail: string;
  tag: string;
  severity: AlertSeverityLabel;
}
