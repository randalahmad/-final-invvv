"use client";

import { useFormState, useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  submitEvidenceAction,
  startReviewAction,
  approveEvidenceAction,
  rejectEvidenceAction,
  archiveEvidenceAction,
  type EvidenceActionState,
} from "@/modules/evidence/actions";

export interface EvidenceFlags {
  canSubmit: boolean;
  canStartReview: boolean;
  canApprove: boolean;
  canReject: boolean;
  canArchive: boolean;
  canLink: boolean;
}

const fieldClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-[13px] outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-border-dark dark:bg-surface-dark";

function Pending({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <>{pending ? "…" : label}</>;
}

function ActionForm({
  action,
  label,
  evidenceId,
  solutionId,
  variant = "outline",
  confirmText,
}: {
  action: (p: EvidenceActionState, fd: FormData) => Promise<EvidenceActionState>;
  label: string;
  evidenceId: string;
  solutionId: string;
  variant?: "default" | "outline";
  confirmText?: string;
}) {
  const [state, formAction] = useFormState<EvidenceActionState, FormData>(action, {});
  return (
    <div className="flex flex-col gap-1">
      <form
        action={formAction}
        onSubmit={(e) => {
          if (confirmText && !confirm(confirmText)) e.preventDefault();
        }}
      >
        <input type="hidden" name="evidenceId" value={evidenceId} />
        <input type="hidden" name="solutionId" value={solutionId} />
        <Button type="submit" size="sm" variant={variant}>
          <Pending label={label} />
        </Button>
      </form>
      {state.error && <span className="text-[11.5px] text-danger">{state.error}</span>}
      {state.success && <span className="text-[11.5px] text-success">{state.success}</span>}
    </div>
  );
}

function RejectForm({ evidenceId, solutionId }: { evidenceId: string; solutionId: string }) {
  const [state, formAction] = useFormState<EvidenceActionState, FormData>(rejectEvidenceAction, {});
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!confirm("هل تريد رفض هذا الدليل؟")) e.preventDefault();
      }}
      className="flex flex-col gap-1.5 rounded-xl bg-slate-50 p-3 dark:bg-white/5"
    >
      <input type="hidden" name="evidenceId" value={evidenceId} />
      <input type="hidden" name="solutionId" value={solutionId} />
      <label htmlFor={`reason-${evidenceId}`} className="text-[11.5px] text-muted">
        سبب الرفض (اختياري)
      </label>
      <textarea id={`reason-${evidenceId}`} name="reason" rows={2} className={fieldClass} placeholder="سبب الرفض" />
      <Button type="submit" size="sm" variant="outline" className="border-danger/40 text-danger hover:bg-danger-bg">
        <Pending label="رفض الدليل" />
      </Button>
      {state.error && <span className="text-[11.5px] text-danger">{state.error}</span>}
    </form>
  );
}

export function EvidenceActionBar({
  evidenceId,
  solutionId,
  flags,
}: {
  evidenceId: string;
  solutionId: string;
  flags: EvidenceFlags;
}) {
  const hasAny = flags.canSubmit || flags.canStartReview || flags.canApprove || flags.canReject || flags.canArchive;
  if (!hasAny) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>إجراءات الدليل</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap items-start gap-2">
        {flags.canSubmit && (
          <ActionForm action={submitEvidenceAction} label="تقديم للمراجعة" evidenceId={evidenceId} solutionId={solutionId} variant="default" />
        )}
        {flags.canStartReview && (
          <ActionForm action={startReviewAction} label="بدء المراجعة" evidenceId={evidenceId} solutionId={solutionId} variant="default" />
        )}
        {flags.canApprove && (
          <ActionForm
            action={approveEvidenceAction}
            label="اعتماد الدليل"
            evidenceId={evidenceId}
            solutionId={solutionId}
            variant="default"
            confirmText="اعتماد هذا الدليل؟ سيُحتسب ضمن نسبة اعتماد الأدلة المرفوعة."
          />
        )}
        {flags.canArchive && (
          <ActionForm
            action={archiveEvidenceAction}
            label="أرشفة"
            evidenceId={evidenceId}
            solutionId={solutionId}
            confirmText="أرشفة هذا الدليل؟"
          />
        )}
        {flags.canReject && <RejectForm evidenceId={evidenceId} solutionId={solutionId} />}
      </CardContent>
    </Card>
  );
}
