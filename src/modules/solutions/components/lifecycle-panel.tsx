"use client";

import { useFormState, useFormStatus } from "react-dom";
import { AlertCircle, CheckCircle2, Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  changeRecordStatusAction,
  changeImplementationAction,
  changeMaturityAction,
  publishSolutionAction,
  unpublishSolutionAction,
  type LifecycleActionState,
} from "@/modules/solutions/lifecycle-actions";
import { RECORD_STATUS_LABELS, IMPLEMENTATION_LABELS, MATURITY_LABELS } from "@/modules/solutions/schema";

const fieldClass =
  "w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-border-dark dark:bg-surface-dark";

export interface LifecycleFlags {
  canUpdate: boolean;
  recordTargets: string[];
  implementationTargets: string[];
  nextMaturity: string | null;
  previousMaturity: string | null;
  canPublish: boolean;
  canUnpublish: boolean;
}

function Feedback({ state }: { state: LifecycleActionState }) {
  if (state.error)
    return (
      <p role="alert" className="flex items-start gap-1.5 text-[12px] text-danger">
        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
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

/** One-click transition button bound to a server action. */
function TransitionButton({
  solutionId,
  to,
  label,
  action,
  confirmText,
  variant = "outline",
}: {
  solutionId: string;
  to: string;
  label: string;
  action: (p: LifecycleActionState, fd: FormData) => Promise<LifecycleActionState>;
  confirmText?: string;
  variant?: "default" | "outline";
}) {
  const [state, formAction] = useFormState<LifecycleActionState, FormData>(action, {});
  return (
    <div className="flex flex-col gap-1">
      <form
        action={formAction}
        onSubmit={(e) => {
          if (confirmText && !confirm(confirmText)) e.preventDefault();
        }}
      >
        <input type="hidden" name="solutionId" value={solutionId} />
        <input type="hidden" name="to" value={to} />
        <Button type="submit" size="sm" variant={variant}>
          <Pending label={label} />
        </Button>
      </form>
      <Feedback state={state} />
    </div>
  );
}

/** Maturity regression requires a documented reason. */
function RegressForm({ solutionId, to }: { solutionId: string; to: string }) {
  const [state, formAction] = useFormState<LifecycleActionState, FormData>(changeMaturityAction, {});
  return (
    <form action={formAction} className="flex flex-col gap-2 rounded-xl bg-slate-50 p-3 dark:bg-white/5">
      <input type="hidden" name="solutionId" value={solutionId} />
      <input type="hidden" name="to" value={to} />
      <Label className="text-[12px]" htmlFor={`regress-${solutionId}`}>
        التراجع إلى «{MATURITY_LABELS[to]}» (سبب موثّق مطلوب)
      </Label>
      <textarea id={`regress-${solutionId}`} name="reason" rows={2} required className={fieldClass} placeholder="سبب التراجع" />
      <Button type="submit" size="sm" variant="outline">
        <Pending label="تسجيل التراجع" />
      </Button>
      <Feedback state={state} />
    </form>
  );
}

export function LifecyclePanel({ solutionId, flags }: { solutionId: string; flags: LifecycleFlags }) {
  const [pubState, publish] = useFormState<LifecycleActionState, FormData>(publishSolutionAction, {});
  const [unpubState, unpublish] = useFormState<LifecycleActionState, FormData>(unpublishSolutionAction, {});

  if (!flags.canUpdate && !flags.canUnpublish) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>دورة حياة الحل</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {flags.recordTargets.length > 0 && (
          <div>
            <p className="mb-1.5 text-[12px] font-semibold text-slate-700 dark:text-slate-200">حالة السجل</p>
            <div className="flex flex-wrap gap-2">
              {flags.recordTargets.map((t) => (
                <TransitionButton
                  key={t}
                  solutionId={solutionId}
                  to={t}
                  label={RECORD_STATUS_LABELS[t] ?? t}
                  action={changeRecordStatusAction}
                  confirmText={t === "ARCHIVED" ? "أرشفة الحل؟ سيتم إلغاء النشر أيضًا." : undefined}
                />
              ))}
            </div>
          </div>
        )}

        {flags.implementationTargets.length > 0 && (
          <div>
            <p className="mb-1.5 text-[12px] font-semibold text-slate-700 dark:text-slate-200">حالة التنفيذ</p>
            <div className="flex flex-wrap gap-2">
              {flags.implementationTargets.map((t) => (
                <TransitionButton
                  key={t}
                  solutionId={solutionId}
                  to={t}
                  label={IMPLEMENTATION_LABELS[t] ?? t}
                  action={changeImplementationAction}
                  confirmText={t === "CANCELLED" ? "إلغاء التنفيذ؟ هذه حالة نهائية." : undefined}
                />
              ))}
            </div>
          </div>
        )}

        {(flags.nextMaturity || flags.previousMaturity) && (
          <div>
            <p className="mb-1.5 text-[12px] font-semibold text-slate-700 dark:text-slate-200">مرحلة النضج</p>
            <div className="flex flex-wrap items-start gap-2">
              {flags.nextMaturity && (
                <TransitionButton
                  solutionId={solutionId}
                  to={flags.nextMaturity}
                  label={`تقدّم إلى ${MATURITY_LABELS[flags.nextMaturity]}`}
                  action={changeMaturityAction}
                  variant="default"
                />
              )}
              {flags.previousMaturity && <RegressForm solutionId={solutionId} to={flags.previousMaturity} />}
            </div>
          </div>
        )}

        <div>
          <p className="mb-1.5 text-[12px] font-semibold text-slate-700 dark:text-slate-200">النشر للاطّلاع</p>
          <p className="mb-2 text-[11.5px] text-muted">
            النشر يتيح الاطّلاع للمستخدمين ذوي صلاحية «مطّلع» فقط، ولا يمثل أي مؤشر امتثال أو جاهزية.
          </p>
          <div className="flex flex-wrap items-start gap-3">
            {flags.canPublish && (
              <div className="flex flex-col gap-1">
                <form action={publish} onSubmit={(e) => { if (!confirm("نشر الحل للاطّلاع؟")) e.preventDefault(); }}>
                  <input type="hidden" name="solutionId" value={solutionId} />
                  <Button type="submit" size="sm">
                    <Eye className="h-4 w-4" />
                    <Pending label="نشر" />
                  </Button>
                </form>
                <Feedback state={pubState} />
              </div>
            )}
            {flags.canUnpublish && (
              <div className="flex flex-col gap-1">
                <form action={unpublish} onSubmit={(e) => { if (!confirm("إلغاء النشر؟ سيختفي فورًا عن المطّلعين.")) e.preventDefault(); }}>
                  <input type="hidden" name="solutionId" value={solutionId} />
                  <Button type="submit" size="sm" variant="outline">
                    <EyeOff className="h-4 w-4" />
                    <Pending label="إلغاء النشر" />
                  </Button>
                </form>
                <Feedback state={unpubState} />
              </div>
            )}
            {!flags.canPublish && !flags.canUnpublish && (
              <p className="text-[11.5px] text-muted">النشر متاح بعد تفعيل الحل واكتمال الحقول المطلوبة.</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
