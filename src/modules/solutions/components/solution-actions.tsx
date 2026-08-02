"use client";

import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { AlertCircle, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { archiveSolutionAction, updateSharedFieldsAction, type SolutionActionState } from "@/modules/solutions/actions";

const fieldClass =
  "w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-border-dark dark:bg-surface-dark";

function Feedback({ state }: { state: SolutionActionState }) {
  if (state.error)
    return (
      <p role="alert" className="flex items-center gap-1.5 text-[12px] text-danger">
        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
        {state.error}
      </p>
    );
  if (state.success)
    return (
      <p className="flex items-center gap-1.5 text-[12px] text-success">
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
        {state.success}
      </p>
    );
  return null;
}
function Pending({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <>{pending ? "…" : label}</>;
}

export function SolutionActionBar({
  solutionId,
  canEdit,
  canArchive,
}: {
  solutionId: string;
  canEdit: boolean;
  canArchive: boolean;
}) {
  const [state, action] = useFormState<SolutionActionState, FormData>(archiveSolutionAction, {});
  if (!canEdit && !canArchive) return null;

  return (
    <div className="flex flex-wrap items-start gap-2">
      {canEdit && (
        <Button asChild size="sm" variant="outline">
          <Link href={`/solutions/${solutionId}/edit`}>تعديل المسودة</Link>
        </Button>
      )}
      {canArchive && (
        <div className="flex flex-col gap-1">
          <form
            action={action}
            onSubmit={(e) => {
              if (!confirm("هل تريد أرشفة هذا الحل؟ لا يتم الحذف نهائيًا.")) e.preventDefault();
            }}
          >
            <input type="hidden" name="solutionId" value={solutionId} />
            <Button type="submit" size="sm" variant="outline">
              <Pending label="أرشفة" />
            </Button>
          </form>
          <Feedback state={state} />
        </div>
      )}
    </div>
  );
}

/**
 * External-partner editing surface: only the fields their active share
 * allow-lists. The server re-validates the share, its allowedActions and
 * allowedFields — this form is never the control.
 */
export function PartnerFieldsForm({
  solutionId,
  allowedFields,
  values,
}: {
  solutionId: string;
  allowedFields: string[];
  values: Record<string, string | null>;
}) {
  const [state, action] = useFormState<SolutionActionState, FormData>(updateSharedFieldsAction, {});
  const LABELS: Record<string, string> = {
    notes: "ملاحظات",
    description: "الوصف",
    technologies: "التقنيات المستخدمة",
    targetBeneficiaries: "الفئة المستفيدة",
    risks: "المخاطر",
  };
  const editable = allowedFields.filter((f) => f in LABELS);
  if (editable.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>تعديل الحقول المشتركة</CardTitle>
        <span className="text-[11.5px] text-muted">ضمن نطاق المشاركة الممنوحة لك</span>
      </CardHeader>
      <CardContent>
        <form action={action} className="flex flex-col gap-3">
          <input type="hidden" name="solutionId" value={solutionId} />
          {editable.map((f) => (
            <div key={f} className="flex flex-col gap-2">
              <Label htmlFor={`pf-${f}`}>{LABELS[f]}</Label>
              <textarea id={`pf-${f}`} name={f} rows={2} className={fieldClass} defaultValue={values[f] ?? ""} />
            </div>
          ))}
          <div>
            <Button type="submit" size="sm">
              <Pending label="حفظ التعديلات" />
            </Button>
          </div>
          <Feedback state={state} />
        </form>
      </CardContent>
    </Card>
  );
}
