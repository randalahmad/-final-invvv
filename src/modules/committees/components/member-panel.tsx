"use client";

import { useFormState, useFormStatus } from "react-dom";
import { AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { addCommitteeMemberAction, updateCommitteeMemberAction, endCommitteeMembershipAction, type CommitteeFormState, type CommitteeActionState } from "@/modules/committees/actions";
import { COMMITTEE_MEMBER_CATEGORY_LABELS } from "@/modules/committees/schema";

export interface MemberRow {
  id: string;
  name: string;
  title: string | null;
  email: string | null;
  category: string | null;
  joinedAt: Date;
  leftAt: Date | null;
}

function Pending({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <>{pending ? "…" : label}</>;
}
function FieldError({ errors }: { errors?: string[] }) {
  return errors?.length ? <p className="text-[11px] text-danger">{errors[0]}</p> : null;
}

function EndMembershipButton({ committeeId, memberId }: { committeeId: string; memberId: string }) {
  const [state, formAction] = useFormState<CommitteeActionState, FormData>(endCommitteeMembershipAction, {});
  return (
    <div className="flex flex-col items-end gap-1">
      <form
        action={formAction}
        onSubmit={(e) => {
          if (!confirm("هل تريد إنهاء عضوية هذا العضو؟")) e.preventDefault();
        }}
      >
        <input type="hidden" name="committeeId" value={committeeId} />
        <input type="hidden" name="memberId" value={memberId} />
        <Button type="submit" size="sm" variant="outline">
          <Pending label="إنهاء العضوية" />
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

function EditMemberForm({ committeeId, member }: { committeeId: string; member: MemberRow }) {
  const [state, formAction] = useFormState<CommitteeFormState, FormData>(updateCommitteeMemberAction, {});
  const fe = state.fieldErrors ?? {};
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2 rounded-xl bg-slate-50 p-2.5 dark:bg-white/5">
      {state.error && (
        <span role="alert" className="text-[11px] text-danger">
          {state.error}
        </span>
      )}
      <input type="hidden" name="committeeId" value={committeeId} />
      <input type="hidden" name="memberId" value={member.id} />
      <div className="flex flex-col gap-1">
        <Label htmlFor={`edit-name-${member.id}`} className="text-[11px]">
          الاسم
        </Label>
        <Input id={`edit-name-${member.id}`} name="name" required defaultValue={member.name} className="h-8 text-[12px]" />
        <FieldError errors={fe.name} />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={`edit-title-${member.id}`} className="text-[11px]">
          الصفة
        </Label>
        <Input id={`edit-title-${member.id}`} name="title" defaultValue={member.title ?? ""} className="h-8 text-[12px]" />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={`edit-category-${member.id}`} className="text-[11px]">
          الفئة
        </Label>
        <select
          id={`edit-category-${member.id}`}
          name="category"
          defaultValue={member.category ?? "EMPLOYEE"}
          className="h-8 rounded-lg border border-border bg-surface px-2 text-[12px] outline-none dark:border-border-dark dark:bg-surface-dark"
        >
          {Object.entries(COMMITTEE_MEMBER_CATEGORY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={`edit-email-${member.id}`} className="text-[11px]">
          البريد الإلكتروني
        </Label>
        <Input id={`edit-email-${member.id}`} name="email" type="email" defaultValue={member.email ?? ""} className="h-8 text-[12px]" />
        <FieldError errors={fe.email} />
      </div>
      <Button type="submit" size="sm" variant="outline">
        <Pending label="حفظ" />
      </Button>
    </form>
  );
}

export function AddMemberForm({ committeeId }: { committeeId: string }) {
  const [state, formAction] = useFormState<CommitteeFormState, FormData>(addCommitteeMemberAction, {});
  const fe = state.fieldErrors ?? {};
  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-2xl border border-dashed border-border p-4 dark:border-border-dark">
      {state.error && (
        <div role="alert" className="flex items-center gap-2 rounded-xl bg-danger-bg px-3.5 py-2.5 text-sm text-danger">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {state.error}
        </div>
      )}
      <input type="hidden" name="committeeId" value={committeeId} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">الاسم</Label>
          <Input id="name" name="name" required aria-required="true" />
          <FieldError errors={fe.name} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="title">الصفة (اختياري)</Label>
          <Input id="title" name="title" placeholder="مثال: رئيس اللجنة" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="category">الفئة</Label>
          <select
            id="category"
            name="category"
            defaultValue="EMPLOYEE"
            className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-border-dark dark:bg-surface-dark"
          >
            {Object.entries(COMMITTEE_MEMBER_CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">البريد الإلكتروني (اختياري)</Label>
          <Input id="email" name="email" type="email" />
          <FieldError errors={fe.email} />
        </div>
      </div>
      <div className="flex justify-end">
        <Button type="submit" size="sm">
          <Pending label="إضافة عضو" />
        </Button>
      </div>
    </form>
  );
}

export function MemberList({ committeeId, members, canManage }: { committeeId: string; members: MemberRow[]; canManage: boolean }) {
  if (members.length === 0) return <p className="text-[12.5px] text-muted">لا يوجد أعضاء مضافون بعد.</p>;
  return (
    <div className="flex flex-col gap-2">
      {members.map((m) => (
        <div key={m.id} className="flex flex-col gap-2 rounded-xl border border-border px-3.5 py-2.5 dark:border-border-dark">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">
                {m.name}
                {m.leftAt && (
                  <Badge variant="neutral" className="ms-2">
                    انتهت العضوية
                  </Badge>
                )}
              </p>
              <p className="text-[11.5px] text-muted">
                {m.title ?? "—"} {m.category ? `· ${COMMITTEE_MEMBER_CATEGORY_LABELS[m.category] ?? m.category}` : ""} {m.email ? `· ${m.email}` : ""}
              </p>
            </div>
            {canManage && !m.leftAt && <EndMembershipButton committeeId={committeeId} memberId={m.id} />}
          </div>
          {canManage && !m.leftAt && <EditMemberForm committeeId={committeeId} member={m} />}
        </div>
      ))}
    </div>
  );
}
