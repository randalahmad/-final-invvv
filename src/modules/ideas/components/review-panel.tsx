"use client";

import { useFormState, useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  startInitialReviewAction,
  advanceToTechnicalReviewAction,
  submitInitialEvaluationAction,
  submitTechnicalEvaluationAction,
  requestMoreInformationAction,
  resubmitInfoAction,
  type EvalFormState,
} from "@/modules/ideas/evaluation-actions";

export interface ReviewFlags {
  canStartInitial: boolean;
  canSubmitInitial: boolean;
  canAdvanceTechnical: boolean;
  canSubmitTechnical: boolean;
  canRequestInfo: boolean;
  canRespondInfo: boolean;
}

const fieldClass =
  "w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-border-dark dark:bg-surface-dark";

type Action = (prev: EvalFormState, fd: FormData) => Promise<EvalFormState>;

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "…" : label}
    </Button>
  );
}
function Feedback({ state }: { state: EvalFormState }) {
  if (state.error) return <p className="text-[11.5px] text-danger">{state.error}</p>;
  if (state.success) return <p className="text-[11.5px] text-success">{state.success}</p>;
  return null;
}

function TransitionForm({ ideaId, action, label, variant = "default" }: { ideaId: string; action: Action; label: string; variant?: "default" | "outline" }) {
  const [state, formAction] = useFormState<EvalFormState, FormData>(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-1">
      <input type="hidden" name="ideaId" value={ideaId} />
      <Button type="submit" size="sm" variant={variant}>
        {label}
      </Button>
      <Feedback state={state} />
    </form>
  );
}

function EvaluationForm({ ideaId, action, title }: { ideaId: string; action: Action; title: string }) {
  const [state, formAction] = useFormState<EvalFormState, FormData>(action, {});
  const fe = state.fieldErrors ?? {};
  return (
    <form action={formAction} className="flex flex-col gap-2 rounded-xl bg-slate-50 p-3 dark:bg-white/5">
      <input type="hidden" name="ideaId" value={ideaId} />
      <div className="text-[12.5px] font-semibold text-slate-700 dark:text-slate-200">{title}</div>
      <div className="flex flex-col gap-1">
        <Label className="text-[11px]" htmlFor={`comments-${title}`}>التعليق</Label>
        <textarea id={`comments-${title}`} name="comments" rows={3} className={fieldClass} placeholder="ملاحظات التقييم" />
        {fe.comments && <p className="text-[11px] text-danger">{fe.comments[0]}</p>}
      </div>
      <div className="flex items-end gap-2">
        <div className="flex flex-col gap-1">
          <Label className="text-[11px]" htmlFor={`score-${title}`}>الدرجة (0–100، اختياري)</Label>
          <Input id={`score-${title}`} name="score" type="number" min={0} max={100} className="w-28" />
        </div>
        <Submit label="حفظ التقييم" />
      </div>
      <Feedback state={state} />
    </form>
  );
}

function TextForm({ ideaId, action, title, name, label, placeholder, submitLabel }: { ideaId: string; action: Action; title: string; name: string; label: string; placeholder: string; submitLabel: string }) {
  const [state, formAction] = useFormState<EvalFormState, FormData>(action, {});
  const fe = state.fieldErrors ?? {};
  return (
    <form action={formAction} className="flex flex-col gap-2 rounded-xl bg-slate-50 p-3 dark:bg-white/5">
      <input type="hidden" name="ideaId" value={ideaId} />
      <div className="text-[12.5px] font-semibold text-slate-700 dark:text-slate-200">{title}</div>
      <div className="flex flex-col gap-1">
        <Label className="text-[11px]" htmlFor={`${name}-${ideaId}`}>{label}</Label>
        <textarea id={`${name}-${ideaId}`} name={name} rows={3} className={fieldClass} placeholder={placeholder} />
        {fe[name] && <p className="text-[11px] text-danger">{fe[name][0]}</p>}
      </div>
      <Submit label={submitLabel} />
      <Feedback state={state} />
    </form>
  );
}

export function ReviewPanel({ ideaId, flags }: { ideaId: string; flags: ReviewFlags }) {
  const anything = Object.values(flags).some(Boolean);
  if (!anything) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>إجراءات المراجعة</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {flags.canStartInitial && (
          <TransitionForm ideaId={ideaId} action={startInitialReviewAction} label="بدء المراجعة الأولية" />
        )}
        {flags.canSubmitInitial && <EvaluationForm ideaId={ideaId} action={submitInitialEvaluationAction} title="تقييم أولي" />}
        {flags.canAdvanceTechnical && (
          <TransitionForm ideaId={ideaId} action={advanceToTechnicalReviewAction} label="الانتقال للمراجعة الفنية" variant="outline" />
        )}
        {flags.canSubmitTechnical && <EvaluationForm ideaId={ideaId} action={submitTechnicalEvaluationAction} title="تقييم فني" />}
        {flags.canRequestInfo && (
          <TextForm ideaId={ideaId} action={requestMoreInformationAction} title="طلب معلومات إضافية" name="requestedInfo" label="المعلومات المطلوبة" placeholder="حدّد ما هو مطلوب من صاحب الفكرة" submitLabel="إرسال الطلب" />
        )}
        {flags.canRespondInfo && (
          <TextForm ideaId={ideaId} action={resubmitInfoAction} title="الرد على طلب المعلومات" name="responseText" label="ردّك" placeholder="أدخل المعلومات المطلوبة" submitLabel="إرسال الرد وإعادة للمراجعة" />
        )}
      </CardContent>
    </Card>
  );
}
