import type { Metadata } from "next";
import Link from "next/link";

import { requirePermission, getAccessContext, can } from "@/server/authz";
import { listApprovedUsersWithRoles, listRoles } from "@/modules/admin/users/service";
import { AssignRoleForm, UserRoleBadges } from "@/modules/admin/users/components/role-assignment";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "إدارة المستخدمين والصلاحيات" };

const STATUS_LABELS: Record<string, string> = { ACTIVE: "نشط", INACTIVE: "غير نشط", SUSPENDED: "موقوف" };
const STATUS_VARIANT: Record<string, "success" | "neutral" | "danger"> = { ACTIVE: "success", INACTIVE: "neutral", SUSPENDED: "danger" };

export default async function AdminUsersPage() {
  await requirePermission("user.manage");
  const ctx = (await getAccessContext())!;
  const canManageRoles = can(ctx, "role.manage");
  const [users, roles] = await Promise.all([listApprovedUsersWithRoles(ctx), canManageRoles ? listRoles(ctx) : Promise.resolve([])]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100">إدارة المستخدمين والصلاحيات</h1>
          <p className="mt-1 text-[13px] text-muted">المستخدمون المعتمدون وأدوارهم على مستوى المنصة.</p>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href="/admin/users/requests">طلبات التسجيل</Link>
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-start">
              <thead>
                <tr className="border-b border-border text-[11.5px] text-muted dark:border-border-dark">
                  <th className="px-4 py-2.5 text-start font-medium">المستخدم</th>
                  <th className="px-4 py-2.5 text-start font-medium">الحالة</th>
                  <th className="px-4 py-2.5 text-start font-medium">الأدوار</th>
                  {canManageRoles && <th className="px-4 py-2.5 text-start font-medium">إسناد دور جديد</th>}
                </tr>
              </thead>
              <tbody>
                {users.map((u: { id: string; name: string; email: string; jobTitle: string | null; status: string; roleAssignments: { id: string; scopeType: string; role: { nameAr: string } }[] }) => (
                  <tr key={u.id} className="border-b border-border/60 last:border-0 dark:border-border-dark/60">
                    <td className="px-4 py-2.5">
                      <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">{u.name}</p>
                      <p className="text-[11.5px] text-muted">
                        {u.email} {u.jobTitle ? `· ${u.jobTitle}` : ""}
                      </p>
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant={STATUS_VARIANT[u.status] ?? "neutral"}>{STATUS_LABELS[u.status] ?? u.status}</Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      <UserRoleBadges roles={u.roleAssignments.map((a) => ({ id: a.id, roleNameAr: a.role.nameAr, scopeType: a.scopeType }))} />
                    </td>
                    {canManageRoles && (
                      <td className="px-4 py-2.5">
                        <AssignRoleForm userId={u.id} roles={roles.map((r: { id: string; nameAr: string }) => ({ id: r.id, nameAr: r.nameAr }))} />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
