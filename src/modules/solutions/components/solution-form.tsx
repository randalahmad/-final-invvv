"use client";

import { useFormState, useFormStatus } from "react-dom";
import { AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSolutionAction, updateSolutionAction, type SolutionFormState } from "@/modules/solutions/actions";
import {
  MATURITY_STAGES,
  IMPLEMENTATION_STATUSES,
  SOLUTION_SOURCES,
  MATURITY_LABELS,
  IMPLEMENTATION_LABELS,
  SOURCE_LABELS,
} from "@/modules/solutions/schema";

const fieldClass =
  "w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-border-dark dark:bg-surface-dark";

export interface Option {
  id: string;
  label: string;
}
export interface SolutionInitial {
  solutionId: string;
  nameAr: string;
  description: string | null;
  problemStatement: string | null;
  owningDepartmentId: string | null;
  source: string;
  activityId: string | null;
  ownerUserId: string | null;
  strategicObjectiveId: string | null;
  maturityStage: string;
  implementationStatus: string;
  startDate: string | null;
  targetEndDate: string | null;
  actualEndDate: string | null;
  durationMonths: number | null;
  cost: string | null;
  targetBeneficiaries: string | null;
  technologies: string | null;
  risks: string | null;
  notes: string | null;
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

export function SolutionForm({
  mode,
  departments,
  activities,
  objectives,
  owners,
  initial,
}: {
  mode: "create" | "edit";
  departments: Option[];
  activities: Option[];
  objectives: Option[];
  owners: Option[];
  initial?: SolutionInitial;
}) {
  const action = mode === "create" ? createSolutionAction : updateSolutionAction;
  const [state, formAction] = useFormState<SolutionFormState, FormData>(action, {});
  const fe = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.error && (
        <div role="alert" className="flex items-center gap-2 rounded-xl bg-danger-bg px-3.5 py-2.5 text-sm text-danger">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {state.error}
        </div>
      )}
      {mode === "edit" && <input type="hidden" name="solutionId" value={initial?.solutionId} />}

      <div className="flex flex-col gap-2">
        <Label htmlFor="nameAr">اسم الحل</Label>
        <Input id="nameAr" name="nameAr" required defaultValue={initial?.nameAr ?? ""} placeholder="اسم الحل الابتكاري" />
        <FieldError errors={fe.nameAr} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="description">الوصف</Label>
          <textarea id="description" name="description" rows={4} className={fieldClass} defaultValue={initial?.description ?? ""} />
          <FieldError errors={fe.description} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="problemStatement">وصف المشكلة</Label>
          <textarea id="problemStatement" name="problemStatement" rows={4} className={fieldClass} defaultValue={initial?.problemStatement ?? ""} />
          <FieldError errors={fe.problemStatement} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="owningDepartmentId">الإدارة المالكة</Label>
          <select id="owningDepartmentId" name="owningDepartmentId" required defaultValue={initial?.owningDepartmentId ?? ""} className={fieldClass}>
            <option value="" disabled>اختر الإدارة…</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
          </select>
          <FieldError errors={fe.owningDepartmentId} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="source">المصدر</Label>
          <select id="source" name="source" defaultValue={initial?.source ?? "INTERNAL_PROPOSAL"} className={fieldClass}>
            {SOLUTION_SOURCES.map((s) => <option key={s} value={s}>{SOURCE_LABELS[s]}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="ownerUserId">المسؤول عن الحل</Label>
          <select id="ownerUserId" name="ownerUserId" defaultValue={initial?.ownerUserId ?? ""} className={fieldClass}>
            <option value="">— غير محدّد —</option>
            {owners.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="maturityStage">مرحلة النضج</Label>
          <select id="maturityStage" name="maturityStage" defaultValue={initial?.maturityStage ?? "CONCEPT"} className={fieldClass}>
            {MATURITY_STAGES.map((m) => <option key={m} value={m}>{MATURITY_LABELS[m]}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="implementationStatus">حالة التنفيذ</Label>
          <select id="implementationStatus" name="implementationStatus" defaultValue={initial?.implementationStatus ?? "PLANNING"} className={fieldClass}>
            {IMPLEMENTATION_STATUSES.map((s) => <option key={s} value={s}>{IMPLEMENTATION_LABELS[s]}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="strategicObjectiveId">الهدف الاستراتيجي</Label>
          <select id="strategicObjectiveId" name="strategicObjectiveId" defaultValue={initial?.strategicObjectiveId ?? ""} className={fieldClass}>
            <option value="">— غير مرتبط —</option>
            {objectives.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="activityId">النشاط المصدر</Label>
          <select id="activityId" name="activityId" defaultValue={initial?.activityId ?? ""} className={fieldClass}>
            <option value="">— بدون نشاط —</option>
            {activities.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="startDate">تاريخ البدء</Label>
          <Input id="startDate" name="startDate" type="date" defaultValue={initial?.startDate ?? ""} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="targetEndDate">تاريخ الانتهاء المستهدف</Label>
          <Input id="targetEndDate" name="targetEndDate" type="date" defaultValue={initial?.targetEndDate ?? ""} />
          <FieldError errors={fe.targetEndDate} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="actualEndDate">تاريخ الانتهاء الفعلي</Label>
          <Input id="actualEndDate" name="actualEndDate" type="date" defaultValue={initial?.actualEndDate ?? ""} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="durationMonths">المدة (بالأشهر)</Label>
          <Input id="durationMonths" name="durationMonths" type="number" min={0} defaultValue={initial?.durationMonths ?? ""} />
          <FieldError errors={fe.durationMonths} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="cost">التكلفة التقديرية (ر.س)</Label>
          <Input id="cost" name="cost" type="number" min={0} step="0.01" defaultValue={initial?.cost ?? ""} />
          <FieldError errors={fe.cost} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="targetBeneficiaries">الفئة المستفيدة</Label>
          <Input id="targetBeneficiaries" name="targetBeneficiaries" defaultValue={initial?.targetBeneficiaries ?? ""} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="technologies">التقنيات المستخدمة</Label>
          <Input id="technologies" name="technologies" defaultValue={initial?.technologies ?? ""} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="risks">المخاطر</Label>
          <textarea id="risks" name="risks" rows={2} className={fieldClass} defaultValue={initial?.risks ?? ""} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="notes">ملاحظات</Label>
          <textarea id="notes" name="notes" rows={2} className={fieldClass} defaultValue={initial?.notes ?? ""} />
        </div>
      </div>

      <div>
        <SubmitButton label={mode === "create" ? "حفظ كمسودة" : "حفظ التعديلات"} />
      </div>
    </form>
  );
}
