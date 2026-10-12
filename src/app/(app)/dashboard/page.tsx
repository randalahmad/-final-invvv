import { LiveReadinessDashboard } from "@/modules/dga/components/live-readiness-dashboard";
import { getLiveReadiness } from "@/modules/dga/live-readiness";
import { getAccessContext, requireUser, isInnovatorOnlyAccount } from "@/server/authz";
import { getOperationalWorkCounts } from "@/modules/governance-workflow/service";
import { redirect } from "next/navigation";
export default async function DashboardPage({ searchParams }: { searchParams: { stage?: string } }) {
  await requireUser();
  const actor = (await getAccessContext())!;
  // A real INNOVATOR-role account has nothing to do on the enterprise
  // readiness dashboard below (no solution/compliance/impact/etc. scope at
  // all) -- its home is the innovation-journey view instead.
  if (isInnovatorOnlyAccount(actor)) redirect("/journey");
  const [data, work] = await Promise.all([getLiveReadiness(actor), getOperationalWorkCounts(actor)]);
  return <LiveReadinessDashboard data={data} work={work} selectedStage={searchParams.stage} />;
}
