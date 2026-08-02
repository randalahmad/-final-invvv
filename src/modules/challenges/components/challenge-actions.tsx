"use client";

import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { updateChallengeStatusAction, archiveChallengeAction, type ChallengeActionState } from "@/modules/challenges/actions";
import { CHALLENGE_STATUSES, CHALLENGE_STATUS_LABELS } from "@/modules/challenges/schema";

const fieldClass =
  "rounded-xl border border-border bg-surface px-3 py-2 text-[13px] outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-border-dark dark:bg-surface-dark";

function Pending({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <>{pending ? "…" : label}</>;
}

function StatusForm({ challengeId, currentStatus }: { challengeId: string; currentStatus: string }) {
  const [state, formAction] = useFormState<ChallengeActionState, FormData>(updateChallengeStatusAction, {});
  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="challengeId" value={challengeId} />
      <select name="status" defaultValue={currentStatus} className={fieldClass}>
        {CHALLENGE_STATUSES.map((s) => (
          <option key={s} value={s}>
            {CHALLENGE_STATUS_LABELS[s]}
          </option>
        ))}
      </select>
      <Button type="submit" size="sm" variant="outline">
        <Pending label="تحديث الحالة" />
      </Button>
      {state.error && (
        <span role="alert" className="text-[11px] text-danger">
          {state.error}
        </span>
      )}
    </form>
  );
}

function ArchiveButton({ challengeId }: { challengeId: string }) {
  const [state, formAction] = useFormState<ChallengeActionState, FormData>(archiveChallengeAction, {});
  return (
    <div className="flex flex-col gap-1">
      <form
        action={formAction}
        onSubmit={(e) => {
          if (!confirm("هل تريد أرشفة هذا التحدي؟")) e.preventDefault();
        }}
      >
        <input type="hidden" name="challengeId" value={challengeId} />
        <Button type="submit" size="sm" variant="outline">
          <Pending label="أرشفة" />
        </Button>
      </form>
      {state.error && (
        <span role="alert" className="text-[11.5px] text-danger">
          {state.error}
        </span>
      )}
    </div>
  );
}

export function ChallengeActionBar({
  challengeId,
  status,
  flags,
}: {
  challengeId: string;
  status: string;
  flags: { canEdit: boolean; canArchive: boolean };
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {flags.canEdit && <StatusForm challengeId={challengeId} currentStatus={status} />}
      {flags.canEdit && (
        <Button asChild size="sm" variant="outline">
          <Link href={`/challenges/${challengeId}/edit`}>تعديل</Link>
        </Button>
      )}
      {flags.canArchive && <ArchiveButton challengeId={challengeId} />}
    </div>
  );
}
