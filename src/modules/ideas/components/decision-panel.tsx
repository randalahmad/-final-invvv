"use client";

import { useFormState, useFormStatus } from "react-dom";
import { AlertCircle, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  approveIdeaAction,
  rejectIdeaAction,
  convertIdeaAction,
  reopenDecisionAction,
  supersedeDecisionAction,
  type DecisionActionState,
} from "@/modules/ideas/decision-actions";
import type { DecisionFlags } from "@/modules/ideas/decision-service";

const fieldClass =
  "w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-border-dark dark:bg-surface-dark";

function Feedback({ state }: { state: DecisionActionState }) {
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

/** Approve / reject with optional rationale (only from TECHNICAL_REVIEW). */
function DecideForm({ ideaId, flags }: { ideaId: string; flags: DecisionFlags }) {
  const [approveState, approve] = useFormState<DecisionActionState, FormData>(approveIdeaAction, {});
  const [rejectState, reject] = useFormState<DecisionActionState, FormData>(rejectIdeaAction, {});
  if (!flags.canApprove && !flags.canReject) return null;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <form action={approve} className="flex flex-col gap-2 rounded-xl bg-slate-50 p-3 dark:bg-white/5">
        <input type="hidden" name="ideaId" value={ideaId} />
        <Label className="text-[12px] font-semibold" htmlFor={`approve-notes-${ideaId}`}>
          اعتماد للتجريب (مبرر اختياري)
        </Label>
        <textarea id={`approve-notes-${ideaId}`} name="notes" rows={2} className={fieldClass} placeholder="مبرر الاعتماد" />
        <Button
          type="submit"
          size="sm"
          onClick={(e) => {
            if (!confirm("تأكيد اعتماد الفكرة للتجريب؟ القرار نهائي.")) e.preventDefault();
          }}
        >
          <Pending label="اعتماد للتجريب" />
        </Button>
        <Feedback state={approveState} />
      </form>

      <form action={reject} className="flex flex-col gap-2 rounded-xl bg-slate-50 p-3 dark:bg-white/5">
        <input type="hidden" name="ideaId" value={ideaId} />
        <Label className="text-[12px] font-semibold" htmlFor={`reject-notes-${ideaId}`}>
          رفض الفكرة (مبرر اختياري)
        </Label>
        <textarea id={`reject-notes-${ideaId}`} name="notes" rows={2} className={fieldClass} placeholder="مبرر الرفض" />
        <Button
          type="submit"
          size="sm"
          variant="outline"
          className="border-danger/40 text-danger hover:bg-danger-bg"
          onClick={(e) => {
            if (!confirm("تأكيد رفض الفكرة؟ القرار نهائي.")) e.preventDefault();
          }}
        >
          <Pending label="رفض الفكرة" />
        </Button>
        <Feedback state={rejectState} />
      </form>
    </div>
  );
}

/** Conversion (only from APPROVED_FOR_PILOT). */
function ConvertForm({ ideaId }: { ideaId: string }) {
  const [state, action] = useFormState<DecisionActionState, FormData>(convertIdeaAction, {});
  return (
    <form action={action} className="flex flex-col gap-2 rounded-xl bg-primary-50/60 p-3">
      <input type="hidden" name="ideaId" value={ideaId} />
      <p className="text-[12px] text-slate-700">الفكرة معتمدة للتجريب — يمكن تحويلها إلى حل ابتكاري مرة واحدة.</p>
      <Button
        type="submit"
        size="sm"
        onClick={(e) => {
          if (!confirm("تأكيد تحويل الفكرة إلى حل ابتكاري؟ لا يمكن التراجع.")) e.preventDefault();
        }}
      >
        <Pending label="تحويل إلى حل ابتكاري" />
      </Button>
      <Feedback state={state} />
    </form>
  );
}

/** Governed correction paths on a finalized decision — each requires a reason. */
function CorrectionForms({ ideaId, decisionId }: { ideaId: string; decisionId: string }) {
  const [reopenState, reopen] = useFormState<DecisionActionState, FormData>(reopenDecisionAction, {});
  const [supersedeState, supersede] = useFormState<DecisionActionState, FormData>(supersedeDecisionAction, {});

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <form action={reopen} className="flex flex-col gap-2 rounded-xl bg-slate-50 p-3 dark:bg-white/5">
        <input type="hidden" name="ideaId" value={ideaId} />
        <input type="hidden" name="decisionId" value={decisionId} />
        <Label className="text-[12px] font-semibold" htmlFor={`reopen-${ideaId}`}>
          إعادة فتح القرار (سبب مطلوب)
        </Label>
        <textarea id={`reopen-${ideaId}`} name="reason" rows={2} required className={fieldClass} placeholder="سبب إعادة الفتح" />
        <Button type="submit" size="sm" variant="outline">
          <Pending label="إعادة فتح القرار" />
        </Button>
        <Feedback state={reopenState} />
      </form>

      <form action={supersede} className="flex flex-col gap-2 rounded-xl bg-slate-50 p-3 dark:bg-white/5">
        <input type="hidden" name="ideaId" value={ideaId} />
        <input type="hidden" name="decisionId" value={decisionId} />
        <Label className="text-[12px] font-semibold" htmlFor={`supersede-${ideaId}`}>
          إصدار قرار مُصحّح (يَنسخ السابق)
        </Label>
        <select id={`supersede-${ideaId}`} name="decision" required defaultValue="" className={fieldClass}>
          <option value="" disabled>
            اختر القرار الجديد…
          </option>
          <option value="APPROVE_FOR_PILOT">اعتماد للتجريب</option>
          <option value="REJECT">رفض</option>
        </select>
        <textarea name="reason" rows={2} required className={fieldClass} placeholder="سبب التصحيح" />
        <Button type="submit" size="sm" variant="outline">
          <Pending label="إصدار قرار مُصحّح" />
        </Button>
        <Feedback state={supersedeState} />
      </form>
    </div>
  );
}

export function DecisionPanel({
  ideaId,
  flags,
  finalizedDecisionId,
}: {
  ideaId: string;
  flags: DecisionFlags;
  finalizedDecisionId: string | null;
}) {
  const showCorrections = (flags.canReopen || flags.canSupersede) && !!finalizedDecisionId;
  if (!flags.canApprove && !flags.canReject && !flags.canConvert && !showCorrections) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>القرار النهائي</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <DecideForm ideaId={ideaId} flags={flags} />
        {flags.canConvert && <ConvertForm ideaId={ideaId} />}
        {showCorrections && <CorrectionForms ideaId={ideaId} decisionId={finalizedDecisionId!} />}
      </CardContent>
    </Card>
  );
}
