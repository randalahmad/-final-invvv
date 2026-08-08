import { AppSidebar } from "@/components/layout/app-sidebar";
import { Topbar } from "@/components/layout/topbar";
import { requireUser, can } from "@/server/authz";
import { isUxPreviewMode, UX_PREVIEW_USER } from "@/lib/ux-preview";

/**
 * Authenticated application shell. Server Component: `requireUser()` enforces the
 * session on the server (in addition to middleware) and supplies the user to the
 * chrome. Redirects to /login when unauthenticated.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const preview = isUxPreviewMode();
  const user = preview ? null : await requireUser();
  const isAdmin = preview || can(user, "user.manage");
  const canViewIdeas = preview || can(user, "idea.view");

  return (
    <div className="flex min-h-screen w-screen max-w-[100vw] overflow-x-hidden bg-bg dark:bg-bg-dark">
      <AppSidebar isAdmin={isAdmin} canViewIdeas={canViewIdeas} />
      <div className="flex min-h-screen w-[calc(100vw-4rem)] min-w-0 max-w-[calc(100vw-4rem)] flex-1 flex-col md:w-[calc(100vw-16rem)] md:max-w-[calc(100vw-16rem)]">
        <Topbar userName={preview ? UX_PREVIEW_USER.name : user!.name} preview={preview} />
        <main className="min-w-0 flex-1 p-4 print:p-0 sm:p-6 lg:p-7">{children}</main>
      </div>
    </div>
  );
}
