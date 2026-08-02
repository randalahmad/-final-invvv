import type { Metadata } from "next";

import { requirePermission, getAccessContext } from "@/server/authz";
import { listAlertsInScope } from "@/modules/alerts/service";
import { AlertsCenter } from "@/modules/alerts/components/alerts-center";

export const metadata: Metadata = { title: "التنبيهات" };

export default async function AlertsPage() {
  await requirePermission("alert.view");
  const ctx = (await getAccessContext())!;
  const alerts = await listAlertsInScope(ctx);
  return <AlertsCenter alerts={alerts} />;
}
