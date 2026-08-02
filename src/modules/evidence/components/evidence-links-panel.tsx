"use client";

import { useFormState, useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { linkEvidenceAction, unlinkEvidenceAction, type EvidenceActionState } from "@/modules/evidence/actions";
import { LINKABLE_ENTITY_TYPES, ENTITY_TYPE_LABELS } from "@/modules/evidence/schema";

export interface EvidenceLinkRow {
  id: string;
  entityType: string;
  entityId: string;
  requirementId: string | null;
  createdAt: Date;
  requirement: { code: string; titleAr: string } | null;
}

const fieldClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-[13px] outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-border-dark dark:bg-surface-dark";

function Pending({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <>{pending ? "…" : label}</>;
}

export function EvidenceLinksPanel({
  evidenceId,
  solutionId,
  solutionLinkEntityId,
  links,
  canLink,
}: {
  evidenceId: string;
  solutionId: string;
  solutionLinkEntityId: string;
  links: EvidenceLinkRow[];
  canLink: boolean;
}) {
  const [addState, addAction] = useFormState<EvidenceActionState, FormData>(linkEvidenceAction, {});
  const [removeState, removeAction] = useFormState<EvidenceActionState, FormData>(unlinkEvidenceAction, {});

  return (
    <Card>
      <CardHeader>
        <CardTitle>ارتباطات الدليل</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {links.length === 0 ? (
          <p className="text-[13px] text-muted">لا توجد ارتباطات بعد.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {links.map((l) => {
              const isOwner = l.entityType === "INNOVATION_SOLUTION" && l.entityId === solutionLinkEntityId;
              return (
                <li
                  key={l.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-3 py-2 dark:border-border-dark"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="primary">{ENTITY_TYPE_LABELS[l.entityType] ?? l.entityType}</Badge>
                    <span className="font-mono text-[11.5px] text-muted">{l.entityId}</span>
                    {l.requirement && (
                      <Badge variant="neutral">
                        متطلب {l.requirement.code} — {l.requirement.titleAr}
                      </Badge>
                    )}
                    {isOwner && <span className="text-[11px] text-muted">(الحل المالك)</span>}
                  </div>
                  {canLink && !isOwner && (
                    <form action={removeAction}>
                      <input type="hidden" name="linkId" value={l.id} />
                      <input type="hidden" name="evidenceId" value={evidenceId} />
                      <input type="hidden" name="solutionId" value={solutionId} />
                      <Button type="submit" size="sm" variant="ghost" className="h-7 px-2 text-[12px] text-danger">
                        <Pending label="إلغاء الربط" />
                      </Button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {removeState.error && <p className="text-[12px] text-danger">{removeState.error}</p>}

        {canLink && (
          <form action={addAction} className="flex flex-col gap-2 rounded-xl bg-slate-50 p-3 dark:bg-white/5">
            <input type="hidden" name="evidenceId" value={evidenceId} />
            <input type="hidden" name="solutionId" value={solutionId} />
            <div className="text-[12px] font-semibold text-slate-700 dark:text-slate-200">إضافة ارتباط</div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div className="flex flex-col gap-1">
                <Label className="text-[11px]" htmlFor={`et-${evidenceId}`}>
                  نوع السجل
                </Label>
                <select id={`et-${evidenceId}`} name="entityType" className={fieldClass} defaultValue="COMPLIANCE_REQUIREMENT">
                  {LINKABLE_ENTITY_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {ENTITY_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-[11px]" htmlFor={`ei-${evidenceId}`}>
                  معرّف السجل
                </Label>
                <Input id={`ei-${evidenceId}`} name="entityId" required placeholder="معرّف السجل المستهدف" />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-[11px]" htmlFor={`rq-${evidenceId}`}>
                  متطلب امتثال (اختياري)
                </Label>
                <Input id={`rq-${evidenceId}`} name="requirementId" placeholder="معرّف المتطلب" />
              </div>
            </div>
            <Button type="submit" size="sm" className="self-start">
              <Pending label="ربط" />
            </Button>
            {addState.error && <span className="text-[12px] text-danger">{addState.error}</span>}
            {addState.success && <span className="text-[12px] text-success">{addState.success}</span>}
          </form>
        )}
      </CardContent>
    </Card>
  );
}
