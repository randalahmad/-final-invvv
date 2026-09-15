import { LiveReadinessDashboard } from "@/modules/dga/components/live-readiness-dashboard";
import { getLiveReadiness } from "@/modules/dga/live-readiness";
import { getAccessContext, requireUser } from "@/server/authz";
import { getOperationalWorkCounts } from "@/modules/governance-workflow/service";
import { redirect } from "next/navigation";
import { isDevelopmentRolePreviewEnabled } from "@/modules/auth/development-role-preview";
export default async function DashboardPage({ searchParams }: { searchParams: { stage?: string } }) { await requireUser(); const actor = (await getAccessContext())!; if (isDevelopmentRolePreviewEnabled() && actor.email === "innovator@innovation.local") redirect("/journey"); const [data, work] = await Promise.all([getLiveReadiness(actor), getOperationalWorkCounts(actor)]); return <LiveReadinessDashboard data={data} work={work} selectedStage={searchParams.stage} />; }
