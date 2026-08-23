"use server";
import { revalidatePath } from "next/cache";
import { getAccessContext } from "@/server/authz";
import { createSolutionIntakeLink, submitPublicSolutionIntake } from "./intake-service";

export type IntakeActionState={error?:string;success?:string;url?:string};
export async function createIntakeLinkAction(_:IntakeActionState,fd:FormData):Promise<IntakeActionState>{const actor=await getAccessContext();if(!actor)return{error:"غير مصرح"};try{const row=await createSolutionIntakeLink(actor,{nameAr:String(fd.get("nameAr")??""),purpose:String(fd.get("purpose")??""),targetDepartmentId:String(fd.get("targetDepartmentId")??"")||undefined,closesAt:fd.get("closesAt")?new Date(String(fd.get("closesAt"))):undefined,instructions:String(fd.get("instructions")??"")});revalidatePath("/solutions/intake-links");return{success:"تم إنشاء الرابط المحدد النطاق",url:`/solution-intake/${row.token}`};}catch{return{error:"تعذر إنشاء الرابط. تحقق من الحقول والصلاحية."};}}
export async function submitIntakeAction(token:string,_:IntakeActionState,fd:FormData):Promise<IntakeActionState>{try{await submitPublicSolutionIntake(token,Object.fromEntries(fd.entries()));return{success:"تم استلام الحل للمراجعة. لم يُعتمد أو يُنشر بعد."};}catch{return{error:"تعذر إرسال الحل. تحقق من الحقول أو صلاحية الرابط."};}}
