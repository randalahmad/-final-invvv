import { LiveReadinessDashboard } from "@/modules/dga/components/live-readiness-dashboard";
import { getLiveReadiness } from "@/modules/dga/live-readiness";
import { getAccessContext, requireUser } from "@/server/authz";
export default async function DashboardPage(){await requireUser();const actor=(await getAccessContext())!;return <LiveReadinessDashboard data={await getLiveReadiness(actor)}/>}
