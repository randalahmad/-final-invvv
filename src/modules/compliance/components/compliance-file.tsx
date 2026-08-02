"use client";

import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { Printer, Download, Info, ShieldAlert, CheckCircle2, XCircle, ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  requestNAAction,
  approveNAAction,
  rejectNAAction,
  revokeNAAction,
  type ComplianceActionState,
} from "@/modules/compliance/actions";
import { READINESS_BAND_LABELS, READINESS_BAND_VARIANT, NA_STATE_LABELS, ESTIMATED_LABEL, ESTIMATED_NOTE } from "@/modules/compliance/schema";
import type { ComplianceFile, RequirementFileEntry } from "@/modules/compliance/service";
import type { ReadinessBand } from "@/modules/compliance/scoring";

const BAND_COLOR: Record<ReadinessBand, string> = {
  READY: "#16a34a",
  NEARLY_READY: "#4F46E5",
  IN_PROGRESS: "#d97706",
  NOT_READY: "#dc2626",
};

function Pending({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <>{pending ? "…" : label}</>;
}

function ReadinessBar({ value, band }: { value: number; band: ReadinessBand }) {
  return (
    <div className="flex items-center gap-2">
      <Progress value={value} color={BAND_COLOR[band]} className="max-w-[220px]" />
      <span className="text-[12.5px] font-semibold text-slate-700 tabular-nums dark:text-slate-200">{value}%</span>
    </div>
  );
}

function NAControls({ entry, solutionId, canConfigure }: { entry: RequirementFileEntry; solutionId: string; canConfigure: boolean }) {
  const [reqState, reqAction] = useFormState<ComplianceActionState, FormData>(requestNAAction, {});
  const [apprState, apprAction] = useFormState<ComplianceActionState, FormData>(approveNAAction, {});
  const [rejState, rejAction] = useFormState<ComplianceActionState, FormData>(rejectNAAction, {});
  const [revState, revAction] = useFormState<ComplianceActionState, FormData>(revokeNAAction, {});

  const state = entry.naStatus.state;
  const canRequest = entry.allowNA && (state === "NONE" || state === "REJECTED" || state === "REVOKED");

  return (
    <div className="mt-3 rounded-lg border border-border/70 bg-slate-50/60 p-2.5 text-[12px] dark:border-border-dark/70 dark:bg-white/5 print:hidden">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted">عدم الانطباق (N/A):</span>
        <Badge variant={state === "APPROVED" ? "warning" : state === "REQUESTED" ? "primary" : "neutral"}>
          {NA_STATE_LABELS[state] ?? state}
        </Badge>
        {entry.naStatus.reason && <span className="text-muted">— {entry.naStatus.reason}</span>}
      </div>

      {!entry.allowNA && state === "NONE" && (
        <p className="mt-1 text-[11px] text-muted">هذا المتطلب لا يسمح باستثناء عدم الانطباق — غياب السجل يُحتسب نقصًا.</p>
      )}

      {canRequest && canConfigure && (
        <form action={reqAction} className="mt-2 flex flex-wrap items-end gap-2">
          <input type="hidden" name="requirementId" value={entry.requirementId} />
          <input type="hidden" name="solutionId" value={solutionId} />
          <div className="flex flex-1 flex-col gap-1">
            <label className="text-[11px] text-muted" htmlFor={`na-${entry.requirementId}`}>سبب طلب الاستثناء (إلزامي)</label>
            <input
              id={`na-${entry.requirementId}`}
              name="reason"
              minLength={10}
              required
              className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-[12.5px] outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-border-dark dark:bg-surface-dark"
            />
          </div>
          <Button type="submit" size="sm" variant="outline"><Pending label="طلب استثناء" /></Button>
          {reqState.error && <span className="text-[11px] text-danger">{reqState.error}</span>}
          {reqState.success && <span className="text-[11px] text-success">{reqState.success}</span>}
        </form>
      )}

      {state === "REQUESTED" && canConfigure && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <form action={apprAction}>
            <input type="hidden" name="naId" value={entry.naStatus.naId ?? ""} />
            <input type="hidden" name="solutionId" value={solutionId} />
            <Button type="submit" size="sm" variant="default"><CheckCircle2 className="h-3.5 w-3.5" /><Pending label="اعتماد الاستثناء" /></Button>
          </form>
          <form action={rejAction}>
            <input type="hidden" name="naId" value={entry.naStatus.naId ?? ""} />
            <input type="hidden" name="solutionId" value={solutionId} />
            <Button type="submit" size="sm" variant="outline" className="text-danger"><XCircle className="h-3.5 w-3.5" /><Pending label="رفض" /></Button>
          </form>
          {(apprState.error || rejState.error) && <span className="text-[11px] text-danger">{apprState.error ?? rejState.error}</span>}
        </div>
      )}

      {state === "APPROVED" && canConfigure && (
        <form action={revAction} className="mt-2">
          <input type="hidden" name="naId" value={entry.naStatus.naId ?? ""} />
          <input type="hidden" name="solutionId" value={solutionId} />
          <Button type="submit" size="sm" variant="outline"><Pending label="إلغاء الاستثناء وإعادة الاحتساب" /></Button>
          {revState.error && <span className="ms-2 text-[11px] text-danger">{revState.error}</span>}
        </form>
      )}
    </div>
  );
}

function RequirementCard({ entry, solutionId, canConfigure }: { entry: RequirementFileEntry; solutionId: string; canConfigure: boolean }) {
  const score = entry.score;
  return (
    <div className="rounded-xl border border-border p-3.5 dark:border-border-dark">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[12px] text-muted">{entry.code}</span>
            <h4 className="text-[14px] font-semibold text-slate-800 dark:text-slate-100">{entry.titleAr}</h4>
          </div>
          {entry.description && <p className="mt-0.5 text-[12px] text-muted">{entry.description}</p>}
        </div>
        <div className="shrink-0">
          {entry.excluded ? (
            <Badge variant="neutral">{entry.unconfigured ? "غير مُهيّأ" : "مستثنى (عدم انطباق معتمد)"}</Badge>
          ) : score ? (
            <Badge variant={READINESS_BAND_VARIANT[score.band]}>{READINESS_BAND_LABELS[score.band]} (تقديري)</Badge>
          ) : null}
        </div>
      </div>

      {!entry.excluded && score && (
        <div className="mt-2.5">
          <ReadinessBar value={score.estimatedReadiness} band={score.band} />
          {score.gated && (
            <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-danger-bg px-2.5 py-1.5 text-[11.5px] text-danger">
              <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              محجوب ببند إلزامي — لا يتجاوز {score.estimatedReadiness}% حتى استيفاء: {score.blockedByMandatory.map((b) => b.label).join("، ")}
            </p>
          )}
        </div>
      )}

      {entry.unconfigured && (
        <p className="mt-2 text-[11.5px] text-muted">لا توجد قواعد حقول أو أدلة مُهيّأة لهذا المتطلب — لا يُحتسب في الإجمالي حتى ضبط إعداده.</p>
      )}

      {(entry.missingFields.length > 0 || entry.missingEvidence.length > 0) && (
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {entry.missingFields.length > 0 && (
            <div>
              <p className="mb-1 text-[11.5px] font-semibold text-slate-600 dark:text-slate-300">حقول ناقصة</p>
              <ul className="flex flex-col gap-1">
                {entry.missingFields.map((f) => (
                  <li key={f.key} className="flex items-center gap-1.5 text-[12px] text-slate-700 dark:text-slate-200">
                    {f.gate && <Badge variant="danger">إلزامي</Badge>}
                    <span>{f.label}</span>
                    <span className="text-muted">— {f.reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {entry.missingEvidence.length > 0 && (
            <div>
              <p className="mb-1 text-[11.5px] font-semibold text-slate-600 dark:text-slate-300">أدلة ناقصة</p>
              <ul className="flex flex-col gap-1">
                {entry.missingEvidence.map((e) => (
                  <li key={e.key} className="flex items-center gap-1.5 text-[12px] text-slate-700 dark:text-slate-200">
                    {e.gate && <Badge variant="danger">إلزامي</Badge>}
                    <span>{e.label}</span>
                    <span className="text-muted tabular-nums">— {e.have}/{e.need} معتمد</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {entry.optionalFields.length > 0 && (
        <p className="mt-2 text-[11px] text-muted">
          معايير اختيارية (لا تؤثر على النتيجة): {entry.optionalFields.map((f) => `${f.label}${f.satisfied ? " ✓" : ""}`).join("، ")}
        </p>
      )}

      {entry.validationErrors.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1">
          {entry.validationErrors.map((v, i) => (
            <li key={i} className="text-[11.5px] text-danger">تحقّق: {v.message}</li>
          ))}
        </ul>
      )}

      <div className="mt-2.5 flex flex-wrap items-center gap-3 text-[11.5px] print:hidden">
        <Link href={`/solutions/${solutionId}`} className="inline-flex items-center gap-1 text-primary hover:underline">
          <ExternalLink className="h-3 w-3" /> بيانات الحل
        </Link>
        <Link href={`/solutions/${solutionId}/evidence`} className="inline-flex items-center gap-1 text-primary hover:underline">
          <ExternalLink className="h-3 w-3" /> أدلة الحل
        </Link>
      </div>

      <NAControls entry={entry} solutionId={solutionId} canConfigure={canConfigure} />
    </div>
  );
}

function PrintButton() {
  return (
    <Button type="button" size="sm" variant="outline" onClick={() => window.print()} className="print:hidden">
      <Printer className="h-4 w-4" /> طباعة
    </Button>
  );
}

export function ComplianceFileView({
  file,
  canConfigure,
  canExport,
}: {
  file: ComplianceFile;
  canConfigure: boolean;
  canExport: boolean;
}) {
  const overall = file.overallReadiness;
  const overallBand = file.overallBand;

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center justify-between gap-3">
            <span>{ESTIMATED_LABEL}</span>
            <span className="flex items-center gap-2 print:hidden">
              <PrintButton />
              {canExport && (
                <Button asChild size="sm" variant="outline">
                  <a href={`/solutions/${file.solution.id}/compliance/export`}>
                    <Download className="h-4 w-4" /> تصدير CSV
                  </a>
                </Button>
              )}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {overall == null || !overallBand ? (
              <Badge variant="neutral">لا توجد متطلبات مُهيّأة بعد</Badge>
            ) : (
              <>
                <div className="text-3xl font-bold tabular-nums text-slate-800 dark:text-slate-100">{overall}%</div>
                <Badge variant={READINESS_BAND_VARIANT[overallBand]}>{READINESS_BAND_LABELS[overallBand]} (تقديري)</Badge>
                <div className="min-w-[200px] flex-1">
                  <ReadinessBar value={overall} band={overallBand} />
                </div>
              </>
            )}
          </div>
          <p className="flex items-start gap-1.5 rounded-lg bg-info-bg px-3 py-2 text-[11.5px] leading-relaxed text-info">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {ESTIMATED_NOTE}
          </p>
        </CardContent>
      </Card>

      {file.sections.map((section) => (
        <Card key={section.code}>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center justify-between gap-2">
              <span>
                <span className="font-mono text-[12px] text-muted">{section.code}</span> {section.titleAr}
              </span>
              {section.readiness != null && section.band && (
                <Badge variant={READINESS_BAND_VARIANT[section.band]}>{section.readiness}% (تقديري)</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {section.requirements.map((entry) => (
              <RequirementCard key={entry.requirementId} entry={entry} solutionId={file.solution.id} canConfigure={canConfigure} />
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
