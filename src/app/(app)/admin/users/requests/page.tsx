import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { prisma } from "@/server/db";
import { getAccessContext } from "@/server/authz";
import { listUsersByRegistration } from "@/modules/admin/users/service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PendingRequestCard, AccountRow, type UserRow, type Option } from "@/modules/admin/users/components/request-review";

export const metadata: Metadata = { title: "طلبات التسجيل" };

function toRow(u: {
  id: string; name: string; email: string; status: string; registrationStatus: string;
  requestedRoleKey: string | null; requestedOrgType: string | null; requestedOrganizationName: string | null;
  requestedDepartmentId: string | null; registrationNote: string | null; createdAt: Date;
}): UserRow {
  return { ...u, createdAt: u.createdAt.toISOString() };
}

export default async function RegistrationRequestsPage() {
  const ctx = await getAccessContext();
  if (!ctx) redirect("/login");

  const [pendingRaw, allRaw, orgsRaw, deptsRaw] = await Promise.all([
    listUsersByRegistration(ctx, "PENDING"),
    listUsersByRegistration(ctx),
    prisma.organization.findMany({ select: { id: true, nameAr: true }, orderBy: { nameAr: "asc" } }),
    prisma.department.findMany({ select: { id: true, nameAr: true }, orderBy: { nameAr: "asc" } }),
  ]);

  const pending = pendingRaw.map(toRow);
  const all = allRaw.map(toRow);
  const orgs: Option[] = orgsRaw.map((o) => ({ id: o.id, label: o.nameAr }));
  const depts: Option[] = deptsRaw.map((d) => ({ id: d.id, label: d.nameAr }));
  const selfId = ctx?.userId ?? "";

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100">إدارة المستخدمين والتسجيل</h1>
        <p className="mt-1 text-[13px] text-muted">مراجعة طلبات التسجيل الجديدة والتحكم في حالة الحسابات.</p>
      </div>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">الطلبات المعلّقة ({pending.length})</TabsTrigger>
          <TabsTrigger value="accounts">إدارة الحسابات ({all.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          {pending.length === 0 ? (
            <Card>
              <CardContent className="px-6 py-14 text-center text-sm text-muted">
                لا توجد طلبات تسجيل معلّقة حاليًا.
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {pending.map((u) => (
                <PendingRequestCard key={u.id} user={u} orgs={orgs} depts={depts} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="accounts">
          <Card>
            <CardHeader>
              <CardTitle>جميع الحسابات</CardTitle>
            </CardHeader>
            <CardContent>
              {all.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted">لا توجد حسابات.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-start">
                    <thead>
                      <tr className="border-b border-border text-[11.5px] text-muted dark:border-border-dark">
                        <th className="py-2 text-start font-medium">المستخدم</th>
                        <th className="py-2 text-start font-medium">حالة التسجيل</th>
                        <th className="py-2 text-start font-medium">حالة الحساب</th>
                        <th className="py-2 text-start font-medium">إجراءات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {all.map((u) => (
                        <AccountRow key={u.id} user={u} isSelf={u.id === selfId} />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
