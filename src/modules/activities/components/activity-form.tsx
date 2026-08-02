"use client";

import { useFormState, useFormStatus } from "react-dom";
import { AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createActivityAction, updateActivityAction, type ActivityFormState } from "@/modules/activities/actions";
import { ACTIVITY_TYPES, ACTIVITY_TYPE_LABELS, ACTIVITY_STATUS_LABELS } from "@/modules/activities/schema";

const fieldClass =
  "w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-border-dark dark:bg-surface-dark";

export interface Option {
  id: string;
  label: string;
}
export interface ActivityInitial {
  activityId: string;
  nameAr: string;
  type: string;
  description: string | null;
  objectivesAr: string | null;
  eventUrl: string | null;
  organizerDepartmentId: string | null;
  startDate: string | null;
  endDate: string | null;
  status: string;
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

export function ActivityForm({ mode, departments, initial }: { mode: "create" | "edit"; departments: Option[]; initial?: ActivityInitial }) {
  const action = mode === "create" ? createActivityAction : updateActivityAction;
  const [state, formAction] = useFormState<ActivityFormState, FormData>(action, {});
  const fe = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate aria-describedby={state.error ? "activity-form-error" : undefined}>
      {state.error && (
        <div id="activity-form-error" role="alert" className="flex items-center gap-2 rounded-xl bg-danger-bg px-3.5 py-2.5 text-sm text-danger">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {state.error}
        </div>
      )}
      {mode === "edit" && <input type="hidden" name="activityId" value={initial?.activityId} />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="nameAr">اسم النشاط</Label>
          <Input id="nameAr" name="nameAr" required aria-required="true" defaultValue={initial?.nameAr ?? ""} placeholder="مثال: ورشة تحسين تجربة المستفيد" />
          <FieldError errors={fe.nameAr} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="type">نوع النشاط</Label>
          <select id="type" name="type" required aria-required="true" defaultValue={initial?.type ?? "WORKSHOP"} className={fieldClass}>
            {ACTIVITY_TYPES.map((t) => (
              <option key={t} value={t}>
                {ACTIVITY_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="description">الوصف</Label>
        <textarea id="description" name="description" rows={3} className={fieldClass} defaultValue={initial?.description ?? ""} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="objectivesAr">الأهداف</Label>
        <textarea id="objectivesAr" name="objectivesAr" rows={2} className={fieldClass} defaultValue={initial?.objectivesAr ?? ""} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="organizerDepartmentId">الجهة المنظمة</Label>
          <select id="organizerDepartmentId" name="organizerDepartmentId" required aria-required="true" defaultValue={initial?.organizerDepartmentId ?? ""} className={fieldClass}>
            <option value="" disabled>
              اختر الجهة…
            </option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
          <FieldError errors={fe.organizerDepartmentId} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="eventUrl">رابط الحدث (اختياري)</Label>
          <Input id="eventUrl" name="eventUrl" type="url" defaultValue={initial?.eventUrl ?? ""} placeholder="https://" />
        </div>
        {mode === "edit" && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="status">الحالة</Label>
            <select id="status" name="status" defaultValue={initial?.status ?? "PLANNED"} className={fieldClass}>
              {Object.entries(ACTIVITY_STATUS_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="flex flex-col gap-2">
          <Label htmlFor="startDate">تاريخ البداية</Label>
          <Input id="startDate" name="startDate" type="date" defaultValue={initial?.startDate ?? ""} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="endDate">تاريخ النهاية</Label>
          <Input id="endDate" name="endDate" type="date" defaultValue={initial?.endDate ?? ""} />
          <FieldError errors={fe.endDate} />
        </div>
      </div>

      <div className="flex justify-end">
        <SubmitButton label={mode === "create" ? "إنشاء النشاط" : "حفظ التعديلات"} />
      </div>
    </form>
  );
}
