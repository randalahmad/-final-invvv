"use server";
import { revalidatePath } from "next/cache";
import { getAccessContext } from "@/server/authz";
import { maxFileBytes } from "@/server/storage";
import { saveRequirementWorkspace, uploadRequirementEvidence, generateRequirementEvidence, WorkspaceError } from "./workspace-service";
import type { WorkspaceData } from "./workspace-status";

export interface WorkspaceActionState { error?:string; success?:string; status?:string }
const messages={FORBIDDEN:"لا تملك صلاحية تعديل هذا المتطلب ضمن نطاقك.",NOT_FOUND:"لم يتم العثور على إسناد متاح لهذا المتطلب.",VALIDATION:"البيانات المدخلة غير صالحة.",STORAGE_FAILED:"تعذّر تخزين الملف."};
function failure(error:unknown):WorkspaceActionState { if(error instanceof WorkspaceError) return {error: error.code==="VALIDATION" && error.message && error.message!=="VALIDATION" ? error.message : messages[error.code]}; if(error instanceof Error && "code" in error) return {error:error.message}; throw error; }

export async function saveWorkspaceAction(_previous:WorkspaceActionState,fd:FormData):Promise<WorkspaceActionState>{ const ctx=await getAccessContext(); if(!ctx)return{error:"غير مصرح"}; const id=String(fd.get("requirementId")??""); try{ const parsed=JSON.parse(String(fd.get("workspaceData")??"{}")) as WorkspaceData; const result=await saveRequirementWorkspace(ctx,id,parsed); revalidatePath(String(fd.get("path")??"/dashboard")); return{success:"تم حفظ التحديث.",status:result.status}; }catch(error){return failure(error);} }

export async function uploadWorkspaceEvidenceAction(_previous:WorkspaceActionState,fd:FormData):Promise<WorkspaceActionState>{ const ctx=await getAccessContext(); if(!ctx)return{error:"غير مصرح"}; const file=fd.get("file"); if(!(file instanceof File)||file.size===0)return{error:"اختر ملف إثبات."}; if(file.size>maxFileBytes())return{error:"حجم الملف يتجاوز الحد المسموح."}; try{ const result=await uploadRequirementEvidence(ctx,String(fd.get("requirementId")??""),String(fd.get("evidenceType")??""),{fileName:file.name,mimeType:file.type,bytes:Buffer.from(await file.arrayBuffer())}); revalidatePath(String(fd.get("path")??"/dashboard")); return{success:"تم رفع الإثبات وربطه بالمتطلب.",status:result.status}; }catch(error){return failure(error);} }

/** 8.4 — Evidence Generator trigger. Builds a real .docx from the requirement's actual data and uploads it through the exact same pipeline as a manual upload. */
export async function generateWorkspaceEvidenceAction(_previous:WorkspaceActionState,fd:FormData):Promise<WorkspaceActionState>{ const ctx=await getAccessContext(); if(!ctx)return{error:"غير مصرح"}; try{ const result=await generateRequirementEvidence(ctx,String(fd.get("requirementId")??""),String(fd.get("evidenceType")??"")); revalidatePath(String(fd.get("path")??"/dashboard")); return{success:"تم توليد مستند الإثبات وحفظه في مستودع الأدلة.",status:result.status}; }catch(error){return failure(error);} }
