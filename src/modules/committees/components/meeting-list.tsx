"use client";

import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { archiveCommitteeMeetingAction, type CommitteeActionState } from "@/modules/committees/actions";
import { MEETING_STATUS_LABELS } from "@/modules/committees/schema";

export interface MeetingRow {
  id: string;
  sequenceNumber: number;
  meetingDate: Date;
  status: string;
  archivedAt: Date | null;
}

const STATUS_VARIANT: Record<string, "success" | "neutral" | "warning" | "danger"> = {
  SCHEDULED: "neutral",
  HELD: "success",
  CANCELLED: "danger",
};

function Pending({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <>{pending ? "…" : label}</>;
}

function ArchiveMeetingButton({ committeeId, meetingId }: { committeeId: string; meetingId: string }) {
  const [state, formAction] = useFormState<CommitteeActionState, FormData>(archiveCommitteeMeetingAction, {});
  return (
    <div className="flex flex-col items-end gap-1">
      <form
        action={formAction}
        onSubmit={(e) => {
          if (!confirm("هل تريد أرشفة هذا الاجتماع؟ رقمه التسلسلي لن يُعاد استخدامه.")) e.preventDefault();
        }}
      >
        <input type="hidden" name="committeeId" value={committeeId} />
        <input type="hidden" name="meetingId" value={meetingId} />
        <Button type="submit" size="sm" variant="outline">
          <Pending label="أرشفة" />
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

export function MeetingList({ committeeId, meetings, canManage }: { committeeId: string; meetings: MeetingRow[]; canManage: boolean }) {
  if (meetings.length === 0) return <p className="text-[12.5px] text-muted">لم يُوثَّق أي اجتماع بعد. الاجتماع الأول مطلوب لتفعيل اللجنة.</p>;
  return (
    <div className="flex flex-col gap-2">
      {meetings.map((m) => (
        <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-3.5 py-2.5 dark:border-border-dark">
          <div>
            <Link href={`/governance/committees/${committeeId}/meetings/${m.id}/edit`} className="text-[13px] font-semibold text-primary hover:underline">
              محضر {m.sequenceNumber}
            </Link>
            <p className="text-[11.5px] text-muted">{new Date(m.meetingDate).toLocaleDateString("ar")}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={m.archivedAt ? "neutral" : (STATUS_VARIANT[m.status] ?? "neutral")}>
              {m.archivedAt ? "مؤرشف" : (MEETING_STATUS_LABELS[m.status] ?? m.status)}
            </Badge>
            {canManage && !m.archivedAt && <ArchiveMeetingButton committeeId={committeeId} meetingId={m.id} />}
          </div>
        </div>
      ))}
    </div>
  );
}
