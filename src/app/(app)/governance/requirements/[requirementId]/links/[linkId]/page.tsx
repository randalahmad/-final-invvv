import { RequirementRoute } from "@/modules/dga/components/requirement-route";

export default function IntakeLinkPage({ params }: { params: { requirementId: string; linkId: string } }) {
  return <RequirementRoute unitIndex={2} requirementId={params.requirementId} eventId={params.linkId} />;
}
