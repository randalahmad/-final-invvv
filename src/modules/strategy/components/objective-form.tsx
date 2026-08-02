"use client";

import { useFormState, useFormStatus } from "react-dom";
import { AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createObjectiveAction, updateObjectiveAction, type StrategyFormState } from "@/modules/strategy/actions";

const fieldClass =
  "w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-border-dark dark:bg-surface-dark";

export interface Option {
  id: string;
  label: string;
}
export interface ObjectiveInitial {
  objectiveId: string;
  code: string | null;
  titleAr: string;
  description: string | null;
  departmentId: string | null;
  responsibleUserId: string | null;
  kpi: string | null;
  targetValue: string | null;
  periodStart: string | null;
  periodEnd: string | null;
}

function FieldError({ errors }: { errors?: string[] }) {
  return errors?.length ? (
    <p className="text-[11.5px] text-danger">{errors[0]}</p>
  ) : null;
}
function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "جارٍ الحفظ…" : label}
    </Button>
  );
}

export function ObjectiveForm({
  mode,
  departments,
  responsibleUsers,
  initial,
}: {
  mode: "create" | "edit";
  departments: Option[];
  responsibleUsers: Option[];
  initial?: ObjectiveInitial;
}) {
  const action = mode === "create" ? createObjectiveAction : updateObjectiveAction;
  const [state, formAction] = useFormState<StrategyFormState, FormData>(action, {});
  const fe = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate aria-describedby={state.error ? "objective-form-error" : undefined}>
      {state.error && (
        <div id="objective-form-error" role="alert" className="flex items-center gap-2 rounded-xl bg-danger-bg px-3.5 py-2.5 text-sm text-danger">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {state.error}
        </div>
      )}
      {mode === "edit" && <input type="hidden" name="objectiveId" value={initial?.objectiveId} />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="titleAr">عنوان الهدف الاستراتيجي</Label>
          <Input id="titleAr" name="titleAr" required defaultValue={initial?.titleAr ?? ""} placeholder="مثال: تحسين النضج الرقمي للجهة" aria-required="true" />
          <FieldError errors={fe.titleAr} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="code">رمز الهدف (اختياري)</Label>
          <Input id="code" name="code" defaultValue={initial?.code ?? ""} placeholder="مثال: SO-01" />
          <FieldError errors={fe.code} />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="description">الوصف</Label>
        <textarea id="description" name="description" rows={3} className={fieldClass} defaultValue={initial?.description ?? ""} />
        <FieldError errors={fe.description} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="departmentId">الجهة المسؤولة</Label>
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
          <p className="text-[11px] text-muted">هذه الجهة ستكون المسؤولة لاحقًا عن استيفاء أي معيار امتثال يُسنَد لهذا الهدف.</p>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="responsibleUserId">المسؤول المباشر</Label>
          <select id="responsibleUserId" name="responsibleUserId" defaultValue={initial?.responsibleUserId ?? ""} className={fieldClass}>
            <option value="">— غير محدّد —</option>
            {responsibleUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="kpi">مؤشر الأداء (KPI)</Label>
          <Input id="kpi" name="kpi" defaultValue={initial?.kpi ?? ""} placeholder="مثال: نسبة الرضا" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="targetValue">القيمة المستهدفة</Label>
          <Input id="targetValue" name="targetValue" defaultValue={initial?.targetValue ?? ""} placeholder="مثال: 90%" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="periodStart">بداية الفترة</Label>
          <Input id="periodStart" name="periodStart" type="date" defaultValue={initial?.periodStart ?? ""} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="periodEnd">نهاية الفترة</Label>
          <Input id="periodEnd" name="periodEnd" type="date" defaultValue={initial?.periodEnd ?? ""} />
          <FieldError errors={fe.periodEnd} />
        </div>
      </div>

      <div className="flex justify-end">
        <SubmitButton label={mode === "create" ? "إنشاء الهدف" : "حفظ التعديلات"} />
      </div>
    </form>
  );
}
