"use client";

import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { submitIdeaAction, withdrawIdeaAction, archiveIdeaAction, restoreIdeaAction, type IdeaActionState } from "@/modules/ideas/actions";

export interface IdeaActionFlags {
  canEdit: boolean;
  canSubmit: boolean;
  canWithdraw: boolean;
  canArchive: boolean;
  canRestore: boolean;
}

function Pending({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <>{pending ? "…" : label}</>;
}

export function TransitionButton({
  ideaId,
  action,
  label,
  variant = "outline",
  confirmText,
  size = "sm",
}: {
  ideaId: string;
  action: (prev: IdeaActionState, fd: FormData) => Promise<IdeaActionState>;
  label: string;
  variant?: "default" | "outline";
  confirmText?: string;
  size?: "sm" | "default";
}) {
  const [state, formAction] = useFormState<IdeaActionState, FormData>(action, {});
  return (
    <div className="flex flex-col gap-1">
      <form
        action={formAction}
        onSubmit={(e) => {
          if (confirmText && !confirm(confirmText)) e.preventDefault();
        }}
      >
        <input type="hidden" name="ideaId" value={ideaId} />
        <Button type="submit" size={size} variant={variant}>
          <Pending label={label} />
        </Button>
      </form>
      {state.error && <span className="text-[11.5px] text-danger">{state.error}</span>}
    </div>
  );
}

export function IdeaActionBar({ ideaId, flags }: { ideaId: string; flags: IdeaActionFlags }) {
  if (!flags.canEdit && !flags.canSubmit && !flags.canWithdraw && !flags.canArchive && !flags.canRestore) return null;
  // An archived idea shows the Restore action only — none of the normal
  // edit-family actions apply to a record that's currently out of the
  // active workflow.
  if (flags.canRestore) {
    return (
      <div className="flex flex-wrap items-start gap-2">
        <TransitionButton ideaId={ideaId} action={restoreIdeaAction} label="استعادة من الأرشيف" variant="default" confirmText="هل تريد استعادة هذه الفكرة من الأرشيف؟" />
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-start gap-2">
      {flags.canEdit && (
        <Button asChild size="sm" variant="outline">
          <Link href={`/governance/ideas/${ideaId}/edit`}>تعديل المسودة</Link>
        </Button>
      )}
      {flags.canSubmit && (
        <TransitionButton ideaId={ideaId} action={submitIdeaAction} label="تقديم الفكرة" variant="default" />
      )}
      {flags.canWithdraw && (
        <TransitionButton ideaId={ideaId} action={withdrawIdeaAction} label="سحب الفكرة" confirmText="هل تريد سحب هذه الفكرة؟" />
      )}
      {flags.canArchive && (
        <TransitionButton ideaId={ideaId} action={archiveIdeaAction} label="أرشفة" confirmText="هل تريد أرشفة هذه الفكرة؟" />
      )}
    </div>
  );
}

/** Compact restore button for use inline in list/table rows (archive view). */
export function RestoreIdeaRowButton({ ideaId }: { ideaId: string }) {
  return (
    <TransitionButton
      ideaId={ideaId}
      action={restoreIdeaAction}
      label="استعادة"
      confirmText="هل تريد استعادة هذه الفكرة من الأرشيف؟"
    />
  );
}
