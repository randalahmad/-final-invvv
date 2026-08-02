"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Download, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { replaceEvidenceFileAction, type EvidenceFormState } from "@/modules/evidence/actions";

const fieldClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-[13px] outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-border-dark dark:bg-surface-dark";

function Pending({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <>{pending ? "…" : label}</>;
}

/**
 * Secure file actions. The download link addresses the evidence by id — the
 * storage key is never rendered or accepted from the client.
 */
export function EvidenceFilePanel({
  evidenceId,
  solutionId,
  hasBinary,
  version,
  canDownload,
  canReplace,
  replaceBlockedReason,
}: {
  evidenceId: string;
  solutionId: string;
  hasBinary: boolean;
  version: number;
  canDownload: boolean;
  canReplace: boolean;
  replaceBlockedReason?: string;
}) {
  const [state, formAction] = useFormState<EvidenceFormState, FormData>(replaceEvidenceFileAction, {});

  return (
    <Card>
      <CardHeader>
        <CardTitle>الملف المخزّن — الإصدار {version}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!hasBinary ? (
          <p className="text-[13px] text-muted">لا يوجد ملف مخزّن لهذا الدليل.</p>
        ) : canDownload ? (
          <div>
            <Button asChild size="sm" variant="outline">
              <a href={`/api/evidence/${evidenceId}/download`} rel="noopener">
                <Download className="h-4 w-4" />
                تنزيل الملف
              </a>
            </Button>
            <p className="mt-1.5 text-[11px] text-muted">رابط التنزيل مُصرَّح به ومحدود الصلاحية، ويُسجَّل في سجل التدقيق.</p>
          </div>
        ) : (
          <p className="text-[13px] text-muted">لا تملك صلاحية تنزيل هذا الملف.</p>
        )}

        {canReplace ? (
          <form action={formAction} className="flex flex-col gap-2 rounded-xl bg-slate-50 p-3 dark:bg-white/5">
            <input type="hidden" name="evidenceId" value={evidenceId} />
            <input type="hidden" name="solutionId" value={solutionId} />
            <div className="text-[12px] font-semibold text-slate-700 dark:text-slate-200">
              استبدال الملف (يُنشئ إصدارًا جديدًا)
            </div>
            <input
              type="file"
              name="file"
              required
              accept=".pdf,.docx,.xlsx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className={fieldClass}
            />
            <p className="text-[11px] text-muted">
              لا يُحذف الملف السابق؛ يُحفظ إصدار جديد وتُسجَّل بيانات الإصدار السابق في سجل التدقيق.
            </p>
            <Button type="submit" size="sm" variant="outline" className="self-start">
              <RefreshCw className="h-4 w-4" />
              <Pending label="استبدال الملف" />
            </Button>
            {state.error && <span className="text-[12px] text-danger">{state.error}</span>}
          </form>
        ) : (
          replaceBlockedReason && <p className="text-[11.5px] text-muted">{replaceBlockedReason}</p>
        )}
      </CardContent>
    </Card>
  );
}
