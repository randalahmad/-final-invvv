import { LiveReadinessDashboard } from "@/modules/dga/components/live-readiness-dashboard";
import { getLiveReadiness } from "@/modules/dga/live-readiness";
import { getAccessContext, requireUser } from "@/server/authz";
import { getOperationalWorkCounts } from "@/modules/governance-workflow/service";
export default async function DashboardPage(){await requireUser();const actor=(await getAccessContext())!;const[data,work]=await Promise.all([getLiveReadiness(actor),getOperationalWorkCounts(actor)]);return <LiveReadinessDashboard data={data} work={work}/>}
