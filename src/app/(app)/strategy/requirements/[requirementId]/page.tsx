import { RequirementRoute } from "@/modules/dga/components/requirement-route";
export default function StrategyRequirementPage({ params }: { params: { requirementId: string } }) { return <RequirementRoute unitIndex={0} requirementId={params.requirementId}/>; }
