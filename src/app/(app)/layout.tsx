import { AppSidebar } from "@/components/layout/app-sidebar";
import { Topbar } from "@/components/layout/topbar";
import { requireUser, can } from "@/server/authz";

/**
 * Authenticated application shell. Server Component: `requireUser()` enforces the
 * session on the server (in addition to middleware) and supplies the user to the
 * chrome. Redirects to /login when unauthenticated.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const isAdmin = can(user, "user.manage");
  const canViewIdeas = can(user, "idea.view");

  return (
    <div className="flex min-h-screen bg-bg dark:bg-bg-dark">
      <AppSidebar isAdmin={isAdmin} canViewIdeas={canViewIdeas} />
      <div className="flex min-h-screen flex-1 flex-col">
        <Topbar userName={user.name} />
        <main className="flex-1 p-6 print:p-0 lg:p-7">{children}</main>
      </div>
    </div>
  );
}
