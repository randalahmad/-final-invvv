"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Sparkles, RefreshCw, Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  runAnalysisAction,
  reviewSuggestionAction,
  acceptHighConfidenceAction,
  type AnalysisActionState,
} from "@/modules/document-analysis/actions";

export interface SuggestionView {
  id: string;
  kind: "FIELD" | "REQUIREMENT_MAP" | "IMPACT_ROW";
  fieldKey: string | null;
  suggestedValue: unknown;
  suggestedRequirementId: string | null;
  requirementLabel?: string | null;
  confidence: number | null;
  band: "HIGH" | "MEDIUM" | "LOW";
  source: { page?: number | null; section?: string | null; cell?: string | null; excerpt?: string | null };
  reviewOutcome: "PENDING" | "ACCEPTED" | "EDITED" | "REJECTED";
}

export interface AnalysisView {
  status: "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";
  provider: string | null;
  model: string | null;
  extractorVersion: string | null;
  promptVersion: string | null;
  completedAt: string | null;
  failedAt: string | null;
  error: string | null;
  suggestions: SuggestionView[];
}

const STATUS_LABEL: Record<string, string> = {
  QUEUED: "قيد الانتظار",
  PROCESSING: "قيد التحليل",
  COMPLETED: "اكتمل",
  FAILED: "فشل",
};
const BAND_LABEL: Record<string, string> = { HIGH: "ثقة مرتفعة", MEDIUM: "ثقة متوسطة", LOW: "ثقة منخفضة" };
const BAND_VARIANT: Record<string, "success" | "warning" | "danger"> = { HIGH: "success", MEDIUM: "warning", LOW: "danger" };
const KIND_LABEL: Record<string, string> = { FIELD: "حقل مقترح", REQUIREMENT_MAP: "ربط بمتطلب", IMPACT_ROW: "صف أثر" };
const OUTCOME_LABEL: Record<string, string> = { PENDING: "بانتظار المراجعة", ACCEPTED: "مقبول", EDITED: "مُعدّل ومقبول", REJECTED: "مرفوض" };

function Pending({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <>{pending ? "…" : label}</>;
}

function valueText(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "string") return v;
  return JSON.stringify(v);
}

function SuggestionRow({ s, evidenceId, solutionId }: { s: SuggestionView; evidenceId: string; solutionId: string }) {
  const [state, formAction] = useFormState<AnalysisActionState, FormData>(reviewSuggestionAction, {});
  const decided = s.reviewOutcome !== "PENDING";

  return (
    <li className="rounded-xl border border-border p-3 dark:border-border-dark">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="primary">{KIND_LABEL[s.kind]}</Badge>
          <Badge variant={BAND_VARIANT[s.band]}>
            {BAND_LABEL[s.band]}
            {s.confidence != null ? ` · ${Math.round(s.confidence * 100)}%` : ""}
          </Badge>
          {decided && <Badge variant="neutral">{OUTCOME_LABEL[s.reviewOutcome]}</Badge>}
        </div>
        {(s.source.page || s.source.section || s.source.cell) && (
          <span className="font-mono text-[11px] text-muted">
            {s.source.page ? `ص${s.source.page}` : ""}
            {s.source.section ? ` ${s.source.section}` : ""}
            {s.source.cell ? ` ${s.source.cell}` : ""}
          </span>
        )}
      </div>

      <div className="mt-2 text-[13px] text-slate-700 dark:text-slate-200">
        {s.kind === "REQUIREMENT_MAP" ? (
          <span>المتطلب المقترح: <b>{s.requirementLabel ?? s.suggestedRequirementId}</b></span>
        ) : (
          <span>
            {s.fieldKey ? <span className="text-muted">{s.fieldKey}: </span> : null}
            <span className="whitespace-pre-wrap break-words">{valueText(s.suggestedValue)}</span>
          </span>
        )}
      </div>
      {s.source.excerpt && <p className="mt-1 rounded bg-slate-50 px-2 py-1 text-[11px] text-muted dark:bg-white/5">“{s.source.excerpt}”</p>}

      {!decided && (
        <form action={formAction} className="mt-2.5 flex flex-wrap items-end gap-2">
          <input type="hidden" name="evidenceId" value={evidenceId} />
          <input type="hidden" name="solutionId" value={solutionId} />
          <input type="hidden" name="suggestionId" value={s.id} />
          {s.kind === "FIELD" && (
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-muted" htmlFor={`edit-${s.id}`}>تعديل القيمة قبل القبول (اختياري)</label>
              <input
                id={`edit-${s.id}`}
                name="editedValue"
                defaultValue={typeof s.suggestedValue === "string" ? s.suggestedValue : ""}
                className="w-64 rounded-lg border border-border bg-surface px-3 py-1.5 text-[13px] outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-border-dark dark:bg-surface-dark"
              />
            </div>
          )}
          <Button type="submit" name="outcome" value="ACCEPTED" size="sm" variant="default">
            <Pending label="قبول" />
          </Button>
          {s.kind === "FIELD" && (
            <Button type="submit" name="outcome" value="EDITED" size="sm" variant="outline">
              <Pending label="قبول بالتعديل" />
            </Button>
          )}
          <Button type="submit" name="outcome" value="REJECTED" size="sm" variant="outline" className="text-danger">
            <Pending label="رفض" />
          </Button>
          {state.error && <span className="text-[11.5px] text-danger">{state.error}</span>}
        </form>
      )}
    </li>
  );
}

export function AnalysisPanel({
  evidenceId,
  solutionId,
  analysis,
  flags,
}: {
  evidenceId: string;
  solutionId: string;
  analysis: AnalysisView | null;
  flags: { canRun: boolean; canReview: boolean; isRunning: boolean };
}) {
  const [runState, runAction] = useFormState<AnalysisActionState, FormData>(runAnalysisAction, {});
  const [bulkState, bulkAction] = useFormState<AnalysisActionState, FormData>(acceptHighConfidenceAction, {});

  const pendingHigh = analysis?.suggestions.filter((s) => s.reviewOutcome === "PENDING" && s.band === "HIGH").length ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          تحليل المستند (مساعد)
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={analysis?.status === "COMPLETED" ? "success" : analysis?.status === "FAILED" ? "danger" : "primary"}>
            {analysis ? STATUS_LABEL[analysis.status] : "غير مُدرَج"}
          </Badge>
          {analysis?.provider && (
            <span className="text-[11.5px] text-muted">
              {analysis.provider} · {analysis.model} · مستخرِج {analysis.extractorVersion}
              {analysis.promptVersion && analysis.promptVersion !== "n/a" ? ` · موجّه ${analysis.promptVersion}` : ""}
              {analysis.completedAt ? ` · ${new Date(analysis.completedAt).toLocaleString("ar")}` : ""}
            </span>
          )}
        </div>

        <p className="flex items-start gap-1.5 rounded-lg bg-info-bg px-3 py-2 text-[11.5px] leading-relaxed text-info">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          الاقتراحات مساعِدة فقط ولا تُعتمد تلقائيًا. نجاح الاستخراج لا يعني اعتماد الدليل — الاعتماد إجراء بشري منفصل.
        </p>

        {analysis?.status === "FAILED" && analysis.error && (
          <p className="rounded-lg bg-danger-bg px-3 py-2 text-[12px] text-danger">
            فشل التحليل ({analysis.error}). المطابقة اليدوية متاحة.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {flags.canRun && (
            <form action={runAction}>
              <input type="hidden" name="evidenceId" value={evidenceId} />
              <input type="hidden" name="solutionId" value={solutionId} />
              <Button type="submit" size="sm" variant={analysis?.status === "FAILED" ? "outline" : "default"}>
                <RefreshCw className="h-4 w-4" />
                <Pending label={analysis?.status === "COMPLETED" ? "إعادة التحليل" : analysis?.status === "FAILED" ? "إعادة المحاولة" : "تشغيل التحليل"} />
              </Button>
            </form>
          )}
          {flags.isRunning && <span className="text-[12px] text-muted">التحليل قيد التنفيذ…</span>}
          {flags.canReview && pendingHigh > 0 && (
            <form action={bulkAction}>
              <input type="hidden" name="evidenceId" value={evidenceId} />
              <input type="hidden" name="solutionId" value={solutionId} />
              <Button type="submit" size="sm" variant="outline">
                <Pending label={`قبول العناصر عالية الثقة (${pendingHigh})`} />
              </Button>
            </form>
          )}
        </div>
        {runState.error && <p className="text-[12px] text-danger">{runState.error}</p>}
        {runState.success && <p className="text-[12px] text-success">{runState.success}</p>}
        {bulkState.success && <p className="text-[12px] text-success">{bulkState.success}</p>}

        {analysis && analysis.suggestions.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {analysis.suggestions.map((s) => (
              <SuggestionRow key={s.id} s={s} evidenceId={evidenceId} solutionId={solutionId} />
            ))}
          </ul>
        ) : analysis?.status === "COMPLETED" ? (
          <p className="text-[13px] text-muted">لم يُنتج التحليل اقتراحات — استخدم المطابقة اليدوية.</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
