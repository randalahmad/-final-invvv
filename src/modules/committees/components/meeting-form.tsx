"use client";

import { useFormState, useFormStatus } from "react-dom";
import { AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createCommitteeMeetingAction, updateCommitteeMeetingAction, type CommitteeFormState } from "@/modules/committees/actions";
import { MEETING_STATUS_LABELS } from "@/modules/committees/schema";

const fieldClass =
  "w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-border-dark dark:bg-surface-dark";

export interface MeetingInitial {
  meetingId: string;
  meetingDate: string;
  status: string;
  agenda: string | null;
  topicsDiscussed: string | null;
  decisionsAndRecommendations: string | null;
}

function FieldError({ errors }: { errors?: string[] }) {
  return errors?.length ? <p className="text-[11.5px] text-danger">{errors[0]}</p> : null;
}
function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "جارٍ الحفظ…" : label}
    </Button>
  );
}

export function MeetingForm({ mode, committeeId, sequenceNumber, initial }: { mode: "create" | "edit"; committeeId: string; sequenceNumber?: number; initial?: MeetingInitial }) {
  const action = mode === "create" ? createCommitteeMeetingAction : updateCommitteeMeetingAction;
  const [state, formAction] = useFormState<CommitteeFormState, FormData>(action, {});
  const fe = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {state.error && (
        <div role="alert" className="flex items-center gap-2 rounded-xl bg-danger-bg px-3.5 py-2.5 text-sm text-danger">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {state.error}
        </div>
      )}
      <input type="hidden" name="committeeId" value={committeeId} />
      {mode === "edit" && <input type="hidden" name="meetingId" value={initial?.meetingId} />}

      {mode === "create" && sequenceNumber === 1 && (
        <p className="rounded-xl bg-primary-50 px-3.5 py-2.5 text-[12.5px] text-primary-700">
          هذا هو الاجتماع الأول — اختيار حالة &quot;مُنعقد&quot; سيُفعّل اللجنة تلقائيًا.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="meetingDate">تاريخ الاجتماع</Label>
          <Input id="meetingDate" name="meetingDate" type="date" required aria-required="true" defaultValue={initial?.meetingDate ?? ""} />
          <FieldError errors={fe.meetingDate} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="status">الحالة</Label>
          <select id="status" name="status" defaultValue={initial?.status ?? "SCHEDULED"} className={fieldClass}>
            {Object.entries(MEETING_STATUS_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="agenda">جدول الأعمال</Label>
        <textarea id="agenda" name="agenda" rows={3} className={fieldClass} defaultValue={initial?.agenda ?? ""} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="topicsDiscussed">المواضيع التي نوقشت</Label>
        <textarea id="topicsDiscussed" name="topicsDiscussed" rows={3} className={fieldClass} defaultValue={initial?.topicsDiscussed ?? ""} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="decisionsAndRecommendations">القرارات والتوصيات</Label>
        <textarea id="decisionsAndRecommendations" name="decisionsAndRecommendations" rows={3} className={fieldClass} defaultValue={initial?.decisionsAndRecommendations ?? ""} />
      </div>

      <div className="flex justify-end">
        <SubmitButton label={mode === "create" ? "حفظ الاجتماع" : "حفظ التعديلات"} />
      </div>
    </form>
  );
}
