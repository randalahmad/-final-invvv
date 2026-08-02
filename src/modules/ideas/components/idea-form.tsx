"use client";

import { useFormState, useFormStatus } from "react-dom";
import { AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createIdeaAction, updateIdeaAction, type IdeaFormState } from "@/modules/ideas/actions";

const fieldClass =
  "w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-border-dark dark:bg-surface-dark";

interface Option {
  id: string;
  nameAr: string;
}
interface Props {
  mode: "create" | "edit";
  departments: Option[];
  activities: Option[];
  initial?: { ideaId: string; titleAr: string; description: string | null; departmentId: string | null; activityId: string | null };
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

export function IdeaForm({ mode, departments, activities, initial }: Props) {
  const action = mode === "create" ? createIdeaAction : updateIdeaAction;
  const [state, formAction] = useFormState<IdeaFormState, FormData>(action, {});
  const fe = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-4">
      {state.error && (
        <div role="alert" className="flex items-center gap-2 rounded-xl bg-danger-bg px-3.5 py-2.5 text-sm text-danger">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {state.error}
        </div>
      )}
      {mode === "edit" && <input type="hidden" name="ideaId" value={initial?.ideaId} />}

      <div className="flex flex-col gap-2">
        <Label htmlFor="titleAr">عنوان الفكرة</Label>
        <Input id="titleAr" name="titleAr" required defaultValue={initial?.titleAr ?? ""} placeholder="عنوان مختصر للفكرة" />
        <FieldError errors={fe.titleAr} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="description">الوصف والمشكلة التي تعالجها</Label>
        <textarea id="description" name="description" rows={5} className={fieldClass} defaultValue={initial?.description ?? ""} placeholder="صف الفكرة والمشكلة التي تحلّها" />
        <FieldError errors={fe.description} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="departmentId">الإدارة المالكة</Label>
          <select id="departmentId" name="departmentId" required defaultValue={initial?.departmentId ?? ""} className={fieldClass}>
            <option value="" disabled>
              اختر الإدارة…
            </option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nameAr}
              </option>
            ))}
          </select>
          <FieldError errors={fe.departmentId} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="activityId">النشاط المصدر (اختياري)</Label>
          <select id="activityId" name="activityId" defaultValue={initial?.activityId ?? ""} className={fieldClass}>
            <option value="">— بدون نشاط —</option>
            {activities.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nameAr}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex gap-2">
        <SubmitButton label={mode === "create" ? "حفظ كمسودة" : "حفظ التعديلات"} />
      </div>
    </form>
  );
}
