import { getRequirementByCode } from "@/modules/dga/workspace-config";
export function requirementHref(code:string){const root=code.startsWith("5.23.1")?"/strategy":code.startsWith("5.23.2")?"/activities":"/governance";return `${root}/requirements/${getRequirementByCode(code)?.requirementId??""}`;}
