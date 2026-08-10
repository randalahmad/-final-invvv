"use client";

import { useFormState, useFormStatus } from "react-dom";
import { AlertCircle, CheckCircle2, Trash2, Trophy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { addSolutionAwardAction, removeSolutionAwardAction, type SolutionActionState } from "@/modules/solutions/actions";

const fieldClass =
  "w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-border-dark dark:bg-surface-dark";

const LEVEL_LABELS: Record<string, string> = { LOCAL: "محلية", REGIONAL: "إقليمية", INTERNATIONAL: "دولية" };

export interface AwardRow {
  id: string;
  nameAr: string;
  level: string;
  awardedAt: Date | string | null;
  evidenceNote: string | null;
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "جارٍ الحفظ…" : label}
    </Button>
  );
}

function RemoveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="text-danger hover:opacity-70" aria-label="إزالة الجائزة">
      <Trash2 className="h-4 w-4" />
    </button>
  );
}

/** 5.24.2 (بند 4): إدارة الجوائز المحلية/الإقليمية/الدولية التي حصل عليها الحل. */
export function AwardsPanel({ solutionId, awards, canEdit }: { solutionId: string; awards: AwardRow[]; canEdit: boolean }) {
  const [addState, addAction] = useFormState<SolutionActionState, FormData>(addSolutionAwardAction, {});
  const [removeState, removeAction] = useFormState<SolutionActionState, FormData>(removeSolutionAwardAction, {});

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-primary" />
          الجوائز (معيار 5.24.2)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {awards.length ? (
          <ul className="space-y-2">
            {awards.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-xs">
                <div>
                  <p className="font-semibold">{a.nameAr}</p>
                  <p className="mt-1 text-muted">
                    <Badge variant="primary">{LEVEL_LABELS[a.level] ?? a.level}</Badge>
                    {a.awardedAt && <span className="mr-2">{new Date(a.awardedAt).toLocaleDateString("ar-SA")}</span>}
                  </p>
                  {a.evidenceNote && <p className="mt-1 text-muted">{a.evidenceNote}</p>}
                </div>
                {canEdit && (
                  <form action={removeAction}>
                    <input type="hidden" name="solutionId" value={solutionId} />
                    <input type="hidden" name="awardId" value={a.id} />
                    <RemoveButton />
                  </form>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted">لا توجد جوائز مسجَّلة لهذا الحل بعد.</p>
        )}
        {removeState.error && (
          <p className="flex items-center gap-1 text-[11.5px] text-danger">
            <AlertCircle className="h-3.5 w-3.5" />
            {removeState.error}
          </p>
        )}

        {canEdit && (
          <form action={addAction} className="grid grid-cols-1 gap-3 border-t pt-3 sm:grid-cols-2">
            <input type="hidden" name="solutionId" value={solutionId} />
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="award-nameAr">اسم الجائزة</Label>
              <Input id="award-nameAr" name="nameAr" required placeholder="مثال: جائزة الابتكار الحكومي" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="award-level">المستوى</Label>
              <select id="award-level" name="level" className={fieldClass} defaultValue="LOCAL">
                <option value="LOCAL">محلية</option>
                <option value="REGIONAL">إقليمية</option>
                <option value="INTERNATIONAL">دولية</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="award-awardedAt">تاريخ الحصول عليها</Label>
              <Input id="award-awardedAt" name="awardedAt" type="date" />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="award-evidenceNote">ملاحظة/إثبات</Label>
              <Input id="award-evidenceNote" name="evidenceNote" placeholder="رابط أو وصف مختصر للدليل" />
            </div>
            <div className="sm:col-span-2">
              <SubmitButton label="إضافة جائزة" />
            </div>
            {addState.error && (
              <p className="flex items-center gap-1 text-[11.5px] text-danger sm:col-span-2">
                <AlertCircle className="h-3.5 w-3.5" />
                {addState.error}
              </p>
            )}
            {addState.success && (
              <p className="flex items-center gap-1 text-[11.5px] text-success sm:col-span-2">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {addState.success}
              </p>
            )}
          </form>
        )}
      </CardContent>
    </Card>
  );
}
