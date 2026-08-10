import { RequirementRoute } from "@/modules/dga/components/requirement-route";
export default function MethodologyRequirementPage({ params }: { params: { requirementId: string } }) { return <RequirementRoute unitIndex={1} requirementId={params.requirementId}/>; }
