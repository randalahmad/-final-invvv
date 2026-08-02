"use client";

import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { archiveObjectiveAction, type StrategyActionState } from "@/modules/strategy/actions";

export interface ObjectiveActionFlags {
  canEdit: boolean;
  canArchive: boolean;
}

function Pending({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <>{pending ? "…" : label}</>;
}

function ArchiveButton({ objectiveId }: { objectiveId: string }) {
  const [state, formAction] = useFormState<StrategyActionState, FormData>(archiveObjectiveAction, {});
  return (
    <div className="flex flex-col gap-1">
      <form
        action={formAction}
        onSubmit={(e) => {
          if (!confirm("هل تريد أرشفة هذا الهدف الاستراتيجي؟")) e.preventDefault();
        }}
      >
        <input type="hidden" name="objectiveId" value={objectiveId} />
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

export function ObjectiveActionBar({ objectiveId, flags }: { objectiveId: string; flags: ObjectiveActionFlags }) {
  if (!flags.canEdit && !flags.canArchive) return null;
  return (
    <div className="flex flex-wrap items-start gap-2">
      {flags.canEdit && (
        <Button asChild size="sm" variant="outline">
          <Link href={`/strategy/${objectiveId}/edit`}>تعديل</Link>
        </Button>
      )}
      {flags.canArchive && <ArchiveButton objectiveId={objectiveId} />}
    </div>
  );
}
