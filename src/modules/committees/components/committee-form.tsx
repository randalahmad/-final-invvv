"use client";

import { useFormState, useFormStatus } from "react-dom";
import { AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createCommitteeAction, updateCommitteeAction, type CommitteeFormState } from "@/modules/committees/actions";

export interface Option {
  id: string;
  label: string;
}
export interface CommitteeInitial {
  committeeId: string;
  nameAr: string;
  category: string | null;
  organizationId: string | null;
  decisionNumber: string | null;
  decisionDate: string | null;
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

export function CommitteeForm({ mode, organizations, initial }: { mode: "create" | "edit"; organizations: Option[]; initial?: CommitteeInitial }) {
  const action = mode === "create" ? createCommitteeAction : updateCommitteeAction;
  const [state, formAction] = useFormState<CommitteeFormState, FormData>(action, {});
  const fe = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {state.error && (
        <div role="alert" className="flex items-center gap-2 rounded-xl bg-danger-bg px-3.5 py-2.5 text-sm text-danger">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {state.error}
        </div>
      )}
      {mode === "edit" && <input type="hidden" name="committeeId" value={initial?.committeeId} />}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="nameAr">اسم اللجنة</Label>
          <Input id="nameAr" name="nameAr" required aria-required="true" placeholder="مثال: لجنة الابتكار" defaultValue={initial?.nameAr ?? ""} />
          <FieldError errors={fe.nameAr} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="category">الغرض/النوع (اختياري)</Label>
          <Input id="category" name="category" placeholder="مثال: لجنة توجيهية" defaultValue={initial?.category ?? ""} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="organizationId">الجهة/المنظمة</Label>
          <select
            id="organizationId"
            name="organizationId"
            required
            aria-required="true"
            defaultValue={initial?.organizationId ?? ""}
            className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-border-dark dark:bg-surface-dark"
          >
            <option value="" disabled>
              اختر الجهة…
            </option>
            {organizations.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
          <FieldError errors={fe.organizationId} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="decisionNumber">رقم قرار التشكيل (اختياري)</Label>
          <Input id="decisionNumber" name="decisionNumber" placeholder="مثال: 2026/14" defaultValue={initial?.decisionNumber ?? ""} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="decisionDate">تاريخ القرار (اختياري)</Label>
          <Input id="decisionDate" name="decisionDate" type="date" defaultValue={initial?.decisionDate ?? ""} />
        </div>
      </div>
      <div className="flex justify-end">
        <SubmitButton label={mode === "create" ? "تشكيل اللجنة" : "حفظ التعديلات"} />
      </div>
    </form>
  );
}
