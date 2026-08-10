export type AlertSeverityLabel = "urgent" | "reminder";

export interface AlertItemData {
  id: string;
  title: string;
  detail: string;
  tag: string;
  severity: AlertSeverityLabel;
  href?: string;
  dueDate?: string;
  responsible?: string;
}
