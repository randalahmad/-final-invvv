"use client";

import { useFormState, useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { assignRoleAction, removeRoleAction, type AdminActionState } from "@/modules/admin/users/actions";

const fieldClass =
  "rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[12px] outline-none dark:border-border-dark dark:bg-surface-dark";

function Pending({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <>{pending ? "…" : label}</>;
}

function RemoveRoleButton({ userRoleId }: { userRoleId: string }) {
  const [state, formAction] = useFormState<AdminActionState, FormData>(removeRoleAction, {});
  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="userRoleId" value={userRoleId} />
      <button type="submit" className="text-[10px] text-danger hover:underline" aria-label="إلغاء إسناد هذا الدور">
        <Pending label="✕" />
      </button>
      {state.error && <span className="ms-1 text-[10px] text-danger">{state.error}</span>}
    </form>
  );
}

export function AssignRoleForm({ userId, roles }: { userId: string; roles: { id: string; nameAr: string }[] }) {
  const [state, formAction] = useFormState<AdminActionState, FormData>(assignRoleAction, {});
  return (
    <form action={formAction} className="flex items-center gap-1.5">
      <input type="hidden" name="userId" value={userId} />
      <select name="roleId" required defaultValue="" className={fieldClass}>
        <option value="" disabled>
          إسناد دور…
        </option>
        {roles.map((r) => (
          <option key={r.id} value={r.id}>
            {r.nameAr}
          </option>
        ))}
      </select>
      <Button type="submit" size="sm" variant="outline">
        <Pending label="إسناد" />
      </Button>
      {state.error && <span className="text-[11px] text-danger">{state.error}</span>}
    </form>
  );
}

export interface UserRoleBadge {
  id: string;
  roleNameAr: string;
  scopeType: string;
}
export function UserRoleBadges({ roles }: { roles: UserRoleBadge[] }) {
  if (roles.length === 0) return <span className="text-[11px] text-muted">بلا أدوار</span>;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {roles.map((r) => (
        <Badge key={r.id} variant="neutral" className="flex items-center gap-1">
          {r.roleNameAr}
          <RemoveRoleButton userRoleId={r.id} />
        </Badge>
      ))}
    </div>
  );
}
