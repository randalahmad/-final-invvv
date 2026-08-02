"use client";

import { useFormState, useFormStatus } from "react-dom";
import { AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createChallengeAction, updateChallengeAction, type ChallengeFormState } from "@/modules/challenges/actions";

const fieldClass =
  "w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-border-dark dark:bg-surface-dark";

export interface Option {
  id: string;
  label: string;
}
export interface ChallengeInitial {
  challengeId: string;
  titleAr: string;
  description: string | null;
  departmentId: string | null;
  category: string | null;
}

function FieldError({ errors }: { errors?: string[] }) {
  return errors?.length ? <p className="text-[11.5px] text-danger">{errors[0]}</p> : null;
}
function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "جارٍ الحفظ…" : label}
    </Button>
  );
}

export function ChallengeForm({ mode, departments, initial }: { mode: "create" | "edit"; departments: Option[]; initial?: ChallengeInitial }) {
  const action = mode === "create" ? createChallengeAction : updateChallengeAction;
  const [state, formAction] = useFormState<ChallengeFormState, FormData>(action, {});
  const fe = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {state.error && (
        <div role="alert" className="flex items-center gap-2 rounded-xl bg-danger-bg px-3.5 py-2.5 text-sm text-danger">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {state.error}
        </div>
      )}
      {mode === "edit" && <input type="hidden" name="challengeId" value={initial?.challengeId} />}

      <div className="flex flex-col gap-2">
        <Label htmlFor="titleAr">عنوان التحدي</Label>
        <Input id="titleAr" name="titleAr" required aria-required="true" defaultValue={initial?.titleAr ?? ""} placeholder="مثال: بطء إجراءات الموافقة الداخلية" />
        <FieldError errors={fe.titleAr} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="description">وصف التحدي</Label>
        <textarea id="description" name="description" rows={4} className={fieldClass} defaultValue={initial?.description ?? ""} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="departmentId">الإدارة المالكة</Label>
          <select id="departmentId" name="departmentId" required aria-required="true" defaultValue={initial?.departmentId ?? ""} className={fieldClass}>
            <option value="" disabled>
              اختر الجهة…
            </option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
          <FieldError errors={fe.departmentId} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="category">المجال/التصنيف (اختياري)</Label>
          <Input id="category" name="category" defaultValue={initial?.category ?? ""} placeholder="مثال: إجراءات إدارية" />
        </div>
      </div>

      <div className="flex justify-end">
        <SubmitButton label={mode === "create" ? "تسجيل التحدي" : "حفظ التعديلات"} />
      </div>
    </form>
  );
}
