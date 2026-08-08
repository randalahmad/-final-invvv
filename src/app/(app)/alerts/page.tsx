import type { Metadata } from "next";

import { requirePermission, getAccessContext } from "@/server/authz";
import { listAlertsInScope } from "@/modules/alerts/service";
import { AlertsCenter } from "@/modules/alerts/components/alerts-center";
import { PageHeader } from "@/components/shared/page-header";

export const metadata: Metadata = { title: "المهام والتنبيهات" };

export default async function AlertsPage() {
  await requirePermission("alert.view");
  const ctx = (await getAccessContext())!;
  const alerts = await listAlertsInScope(ctx);
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="المهام والتنبيهات" description="المواعيد والإجراءات التي تحتاج إلى انتباهك ضمن نطاق صلاحياتك." />
      <AlertsCenter alerts={alerts} />
    </div>
  );
}
