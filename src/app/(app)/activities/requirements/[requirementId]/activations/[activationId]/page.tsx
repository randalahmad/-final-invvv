import {RequirementRoute} from "@/modules/dga/components/requirement-route";
export default function Page({params}:{params:{requirementId:string;activationId:string}}){return <RequirementRoute unitIndex={1} requirementId={params.requirementId} eventId={params.activationId}/>;}
