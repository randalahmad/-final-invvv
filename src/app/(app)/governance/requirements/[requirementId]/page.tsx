import { RequirementRoute } from "@/modules/dga/components/requirement-route";
export default function GovernanceRequirementPage({ params }: { params: { requirementId: string } }) { return <RequirementRoute unitIndex={2} requirementId={params.requirementId}/>; }
