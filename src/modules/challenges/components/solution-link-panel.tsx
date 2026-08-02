"use client";

import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { linkChallengeSolutionAction, unlinkChallengeSolutionAction, type ChallengeFormState, type ChallengeActionState } from "@/modules/challenges/actions";

const fieldClass =
  "w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-border-dark dark:bg-surface-dark";

export interface LinkedSolutionRow {
  solutionId: string;
  nameAr: string;
  maturityStage: string;
  implementationStatus: string;
}
export interface SolutionOption {
  id: string;
  nameAr: string;
}

function Pending({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <>{pending ? "…" : label}</>;
}

function UnlinkButton({ challengeId, solutionId }: { challengeId: string; solutionId: string }) {
  const [state, formAction] = useFormState<ChallengeActionState, FormData>(unlinkChallengeSolutionAction, {});
  return (
    <div className="flex flex-col items-end gap-1">
      <form action={formAction}>
        <input type="hidden" name="challengeId" value={challengeId} />
        <input type="hidden" name="solutionId" value={solutionId} />
        <Button type="submit" size="sm" variant="outline">
          <Pending label="إلغاء الربط" />
        </Button>
      </form>
      {state.error && (
        <span role="alert" className="text-[11px] text-danger">
          {state.error}
        </span>
      )}
    </div>
  );
}

export function LinkSolutionForm({ challengeId, options }: { challengeId: string; options: SolutionOption[] }) {
  const [state, formAction] = useFormState<ChallengeFormState, FormData>(linkChallengeSolutionAction, {});
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      {state.error && (
        <span role="alert" className="text-[11.5px] text-danger">
          {state.error}
        </span>
      )}
      <input type="hidden" name="challengeId" value={challengeId} />
      <div className="flex min-w-[220px] flex-1 flex-col gap-1.5">
        <label htmlFor="solutionId" className="text-[11.5px] text-muted">
          اختر حلًّا لربطه بهذا التحدي
        </label>
        <select id="solutionId" name="solutionId" required className={fieldClass} defaultValue="">
          <option value="" disabled>
            اختر حلًّا…
          </option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.nameAr}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" size="sm">
        <Pending label="ربط الحل" />
      </Button>
    </form>
  );
}

export function LinkedSolutionsList({ challengeId, solutions, canManage }: { challengeId: string; solutions: LinkedSolutionRow[]; canManage: boolean }) {
  if (solutions.length === 0) return <p className="text-[12.5px] text-muted">لا توجد حلول مرتبطة بهذا التحدي بعد.</p>;
  return (
    <div className="flex flex-col gap-2">
      {solutions.map((s) => (
        <div key={s.solutionId} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-3.5 py-2.5 dark:border-border-dark">
          <div>
            <Link href={`/solutions/${s.solutionId}`} className="text-[13px] font-semibold text-primary hover:underline">
              {s.nameAr}
            </Link>
            <div className="mt-1 flex gap-1.5">
              <Badge variant="neutral">{s.maturityStage}</Badge>
              <Badge variant="neutral">{s.implementationStatus}</Badge>
            </div>
          </div>
          {canManage && <UnlinkButton challengeId={challengeId} solutionId={s.solutionId} />}
        </div>
      ))}
    </div>
  );
}
