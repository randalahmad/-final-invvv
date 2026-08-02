"use client";

import { useFormState, useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { approveAction, rejectAction, accountStateAction, type AdminActionState } from "@/modules/admin/users/actions";

export interface UserRow {
  id: string;
  name: string;
  email: string;
  status: string;
  registrationStatus: string;
  requestedRoleKey: string | null;
  requestedOrgType: string | null;
  requestedOrganizationName: string | null;
  requestedDepartmentId: string | null;
  registrationNote: string | null;
  createdAt: string;
}
export interface Option {
  id: string;
  label: string;
}

const fieldClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-[13px] outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-border-dark dark:bg-surface-dark";
const ROLE_LABEL: Record<string, string> = {
  INTERNAL_EDITOR: "محرر داخلي",
  EXTERNAL_PARTNER: "شريك خارجي",
  VIEWER: "مطّلع",
  SYSTEM_ADMIN: "مدير النظام",
};
const REG_BADGE: Record<string, string> = { PENDING: "قيد الانتظار", APPROVED: "معتمد", REJECTED: "مرفوض" };
const STATUS_LABEL: Record<string, string> = { ACTIVE: "نشط", INACTIVE: "غير مفعّل", SUSPENDED: "موقوف" };

function Msg({ state }: { state: AdminActionState }) {
  if (state.error) return <p className="text-[12px] text-danger">{state.error}</p>;
  if (state.success) return <p className="text-[12px] text-success">{state.success}</p>;
  return null;
}
function Pending({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <>{pending ? "…" : label}</>;
}

export function PendingRequestCard({ user, orgs, depts }: { user: UserRow; orgs: Option[]; depts: Option[] }) {
  const [approveState, approve] = useFormState<AdminActionState, FormData>(approveAction, {});
  const [rejectState, reject] = useFormState<AdminActionState, FormData>(rejectAction, {});

  return (
    <div className="rounded-2xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[13.5px] font-bold text-slate-800 dark:text-slate-100">{user.name}</div>
          <div className="text-[12px] text-muted">{user.email}</div>
        </div>
        <Badge variant="primary">الدور المطلوب: {ROLE_LABEL[user.requestedRoleKey ?? ""] ?? "—"}</Badge>
      </div>

      <dl className="mb-3 grid grid-cols-2 gap-x-4 gap-y-1 text-[12px] text-slate-600 dark:text-slate-300">
        <div><dt className="inline text-muted">الجهة: </dt><dd className="inline">{user.requestedOrganizationName ?? "—"}</dd></div>
        <div><dt className="inline text-muted">الإدارة المطلوبة: </dt><dd className="inline">{user.requestedDepartmentId ?? "—"}</dd></div>
        <div className="col-span-2"><dt className="inline text-muted">ملاحظة: </dt><dd className="inline">{user.registrationNote ?? "—"}</dd></div>
        <div><dt className="inline text-muted">تاريخ الطلب: </dt><dd className="inline">{new Date(user.createdAt).toLocaleDateString("ar")}</dd></div>
      </dl>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Approve */}
        <form action={approve} className="flex flex-col gap-2 rounded-xl bg-slate-50 p-3 dark:bg-white/5">
          <input type="hidden" name="userId" value={user.id} />
          <div className="text-[12px] font-semibold text-slate-700 dark:text-slate-200">اعتماد وتحديد الصلاحية</div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <Label className="text-[11px]" htmlFor={`role-${user.id}`}>الدور</Label>
              <select id={`role-${user.id}`} name="roleKey" defaultValue={user.requestedRoleKey ?? "VIEWER"} className={fieldClass}>
                <option value="INTERNAL_EDITOR">محرر داخلي</option>
                <option value="EXTERNAL_PARTNER">شريك خارجي</option>
                <option value="VIEWER">مطّلع</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-[11px]" htmlFor={`scope-${user.id}`}>نوع النطاق</Label>
              <select id={`scope-${user.id}`} name="scopeType" defaultValue="DEPARTMENT" className={fieldClass}>
                <option value="PLATFORM">المنصة</option>
                <option value="ORGANIZATION">مؤسسة</option>
                <option value="DEPARTMENT">إدارة</option>
                <option value="AGREEMENT">اتفاقية</option>
                <option value="SOLUTION">حل</option>
                <option value="PUBLISHED">منشور فقط</option>
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-[11px]" htmlFor={`scopeId-${user.id}`}>معرّف النطاق (للنطاقات المحددة)</Label>
            <input id={`scopeId-${user.id}`} name="scopeId" list={`depts-${user.id}`} className={fieldClass} placeholder="مثال: dept-digital" />
            <datalist id={`depts-${user.id}`}>
              {depts.map((d) => (
                <option key={d.id} value={d.id}>{d.label}</option>
              ))}
            </datalist>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <Label className="text-[11px]" htmlFor={`org-${user.id}`}>عضوية المؤسسة</Label>
              <select id={`org-${user.id}`} name="organizationId" defaultValue="" className={fieldClass}>
                <option value="">—</option>
                {orgs.map((o) => (<option key={o.id} value={o.id}>{o.label}</option>))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-[11px]" htmlFor={`memdept-${user.id}`}>عضوية الإدارة</Label>
              <select id={`memdept-${user.id}`} name="departmentId" defaultValue="" className={fieldClass}>
                <option value="">—</option>
                {depts.map((d) => (<option key={d.id} value={d.id}>{d.label}</option>))}
              </select>
            </div>
          </div>
          <Button type="submit" size="sm" className="mt-1"><Pending label="اعتماد وتفعيل" /></Button>
          <Msg state={approveState} />
        </form>

        {/* Reject */}
        <form
          action={reject}
          onSubmit={(e) => { if (!confirm("هل أنت متأكد من رفض هذا الطلب؟")) e.preventDefault(); }}
          className="flex flex-col gap-2 rounded-xl bg-slate-50 p-3 dark:bg-white/5"
        >
          <input type="hidden" name="userId" value={user.id} />
          <div className="text-[12px] font-semibold text-slate-700 dark:text-slate-200">رفض الطلب</div>
          <div className="flex flex-col gap-1">
            <Label className="text-[11px]" htmlFor={`reason-${user.id}`}>سبب داخلي (لا يظهر للمستخدم)</Label>
            <textarea id={`reason-${user.id}`} name="reason" rows={2} className={fieldClass} placeholder="سبب الرفض (اختياري)" />
          </div>
          <Button type="submit" size="sm" variant="outline" className="mt-1 border-danger/40 text-danger hover:bg-danger-bg">
            <Pending label="رفض الطلب" />
          </Button>
          <Msg state={rejectState} />
        </form>
      </div>
    </div>
  );
}

export function AccountRow({ user, isSelf }: { user: UserRow; isSelf: boolean }) {
  const [state, act] = useFormState<AdminActionState, FormData>(accountStateAction, {});
  const reg = user.registrationStatus;
  const st = user.status;

  const actions: { action: string; label: string; confirm?: boolean; show: boolean }[] = [
    { action: "ACTIVATE", label: "تفعيل", show: reg === "APPROVED" && st === "INACTIVE" },
    { action: "RESTORE", label: "استعادة", show: reg === "APPROVED" && st === "SUSPENDED" },
    { action: "DEACTIVATE", label: "إيقاف التفعيل", confirm: true, show: reg === "APPROVED" && st === "ACTIVE" && !isSelf },
    { action: "SUSPEND", label: "تعليق", confirm: true, show: reg === "APPROVED" && (st === "ACTIVE" || st === "INACTIVE") && !isSelf },
  ];

  return (
    <tr className="border-b border-border/60 dark:border-border-dark/60">
      <td className="py-2.5">
        <div className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">{user.name}</div>
        <div className="text-[11.5px] text-muted">{user.email}</div>
      </td>
      <td className="py-2.5 text-[12px]">{REG_BADGE[reg] ?? reg}</td>
      <td className="py-2.5 text-[12px]">{STATUS_LABEL[st] ?? st}</td>
      <td className="py-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          {actions.filter((a) => a.show).map((a) => (
            <form
              key={a.action}
              action={act}
              onSubmit={(e) => { if (a.confirm && !confirm("تأكيد تنفيذ الإجراء؟")) e.preventDefault(); }}
            >
              <input type="hidden" name="userId" value={user.id} />
              <input type="hidden" name="action" value={a.action} />
              <Button type="submit" size="sm" variant="ghost" className="h-7 px-2 text-[12px]">
                <Pending label={a.label} />
              </Button>
            </form>
          ))}
          {isSelf && <span className="text-[11px] text-muted">(حسابك)</span>}
        </div>
        <Msg state={state} />
      </td>
    </tr>
  );
}
