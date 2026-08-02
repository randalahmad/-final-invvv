"use client";

import { useFormState, useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { archiveCommitteeAction, type CommitteeActionState } from "@/modules/committees/actions";

function Pending({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <>{pending ? "…" : label}</>;
}

export function ArchiveCommitteeButton({ committeeId }: { committeeId: string }) {
  const [state, formAction] = useFormState<CommitteeActionState, FormData>(archiveCommitteeAction, {});
  return (
    <div className="flex flex-col gap-1">
      <form
        action={formAction}
        onSubmit={(e) => {
          if (!confirm("هل تريد أرشفة هذه اللجنة؟")) e.preventDefault();
        }}
      >
        <input type="hidden" name="committeeId" value={committeeId} />
        <Button type="submit" size="sm" variant="outline">
          <Pending label="أرشفة اللجنة" />
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
