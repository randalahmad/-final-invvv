import {notFound} from "next/navigation";
import {getWorkspaceConfig} from "@/modules/dga/workspace-config";
import {ContributorWorkspace} from "@/modules/requirement-contributions/components/contributor-workspace";
import {loadInvite} from "@/modules/requirement-contributions/service";

export default async function ContributionPage({params}:{params:{token:string}}){try{const invite=await loadInvite(params.token);const section=getWorkspaceConfig("5-23-1-r1")!.sections.find(item=>item.key===invite.sectionKey);if(!section)notFound();return <ContributorWorkspace token={params.token} organization={invite.organization} section={section} dueDate={invite.dueDate} note={invite.note} initial={invite.latestData}/>;}catch{notFound();}}
