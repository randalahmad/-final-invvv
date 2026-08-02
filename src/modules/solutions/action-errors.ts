import { isAuthorizationError } from "@/server/authorization";
import { SolutionError } from "./service";

export interface ActionState {
  error?: string;
  success?: string;
}

const AUTHZ_MSG: Record<string, string> = {
  FORBIDDEN: "لا تملك صلاحية تنفيذ هذا الإجراء",
  OUT_OF_SCOPE: "هذا الحل خارج نطاق صلاحياتك",
  NOT_FOUND: "الحل غير موجود",
  FIELD_FORBIDDEN: "أحد الحقول غير مسموح بتعديله ضمن المشاركة",
  SHARE_INACTIVE: "لا توجد مشاركة سارية",
  ACTION_NOT_ALLOWED: "هذا الإجراء غير مسموح ضمن المشاركة",
};
const FALLBACK: Record<string, string> = {
  VALIDATION: "يرجى تصحيح الحقول المطلوبة",
  NOT_DRAFT: "يمكن تعديل المسودات فقط",
  INVALID_STATE: "لا يمكن تنفيذ هذا الإجراء على الحالة الحالية",
  INVALID_TRANSITION: "انتقال غير مسموح",
  PUBLISH_INCOMPLETE: "بيانات الحل غير مكتملة للنشر",
  REASON_REQUIRED: "السبب مطلوب",
  DUPLICATE: "العنصر مضاف بالفعل",
  BAD_REFERENCE: "أحد المراجع غير صالح",
};

/** Map a thrown domain/authorization error to a user-facing Arabic state. */
export function toActionState(e: unknown): ActionState {
  if (e instanceof SolutionError) {
    // Prefer the specific Arabic message the service produced.
    const specific = e.message && e.message !== e.code ? e.message : null;
    return { error: specific ?? FALLBACK[e.code] ?? "تعذّر تنفيذ الإجراء" };
  }
  if (isAuthorizationError(e)) return { error: AUTHZ_MSG[e.code] ?? "غير مصرّح" };
  throw e; // re-throw NEXT_REDIRECT / unknown
}
