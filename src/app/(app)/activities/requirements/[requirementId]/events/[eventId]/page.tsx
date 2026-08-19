import {RequirementRoute} from "@/modules/dga/components/requirement-route";

export default function OpenInnovationEventPage({params}:{params:{requirementId:string;eventId:string}}){
  return <RequirementRoute unitIndex={1} requirementId={params.requirementId} eventId={params.eventId}/>;
}
