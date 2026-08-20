import { RequirementRoute } from "@/modules/dga/components/requirement-route";

export default function CultureActivityPage({ params }: { params: { requirementId: string; activityId: string } }) {
  return <RequirementRoute unitIndex={2} requirementId={params.requirementId} eventId={params.activityId} />;
}
