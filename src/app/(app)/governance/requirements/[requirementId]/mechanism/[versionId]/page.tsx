import { RequirementRoute } from "@/modules/dga/components/requirement-route";

export default function DigitalInnovationMechanismPage({ params }: { params: { requirementId: string; versionId: string } }) {
  return <RequirementRoute unitIndex={2} requirementId={params.requirementId} eventId={params.versionId} />;
}
