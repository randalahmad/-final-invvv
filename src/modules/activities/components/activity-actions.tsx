"use client";

import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { archiveActivityAction, type ActivityActionState } from "@/modules/activities/actions";

export interface ActivityActionFlags {
  canEdit: boolean;
  canArchive: boolean;
}

function Pending({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <>{pending ? "…" : label}</>;
}

function ArchiveButton({ activityId }: { activityId: string }) {
  const [state, formAction] = useFormState<ActivityActionState, FormData>(archiveActivityAction, {});
  return (
    <div className="flex flex-col gap-1">
      <form
        action={formAction}
        onSubmit={(e) => {
          if (!confirm("هل تريد أرشفة هذا النشاط؟")) e.preventDefault();
        }}
      >
        <input type="hidden" name="activityId" value={activityId} />
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

export function ActivityActionBar({ activityId, flags }: { activityId: string; flags: ActivityActionFlags }) {
  if (!flags.canEdit && !flags.canArchive) return null;
  return (
    <div className="flex flex-wrap items-start gap-2">
      {flags.canEdit && (
        <Button asChild size="sm" variant="outline">
          <Link href={`/activities/${activityId}/edit`}>تعديل</Link>
        </Button>
      )}
      {flags.canArchive && <ArchiveButton activityId={activityId} />}
    </div>
  );
}
