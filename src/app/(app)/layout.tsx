import { AppSidebar } from "@/components/layout/app-sidebar";
import { Topbar } from "@/components/layout/topbar";
import { isUxPreviewMode, UX_PREVIEW_PERSONAS } from "@/lib/ux-preview";
import { isDevelopmentRolePreviewEnabled, listDevelopmentRolePreviewOptions } from "@/modules/auth/development-role-preview";
import type { AccessContext } from "@/server/access-context";

/**
 * Authenticated application shell. Server Component: `requireUser()` enforces the
 * session on the server (in addition to middleware) and supplies the user to the
 * chrome. Redirects to /login when unauthenticated.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const preview = isUxPreviewMode();
  let user: AccessContext | null = null;
  if (!preview) {
    const { requireUser } = await import("@/server/authz");
    user = await requireUser();
  }
  const permissions = user ? Array.from(user.permissions) : [];
  const innovatorPreview = !preview && user?.email === "innovator@innovation.local" && isDevelopmentRolePreviewEnabled();
  const alerts = user && permissions.includes("alert.view") ? await (await import("@/modules/alerts/service")).listAlertsInScope(user) : [];
  const developmentRoleOptions = !preview && isDevelopmentRolePreviewEnabled() ? await listDevelopmentRolePreviewOptions() : [];

  return (
    <div className="flex min-h-screen w-screen max-w-[100vw] overflow-x-hidden bg-bg dark:bg-bg-dark">
      <AppSidebar permissions={permissions} preview={preview} innovatorPreview={innovatorPreview} />
      <div className="flex min-h-screen w-full min-w-0 max-w-full flex-1 flex-col pb-[4.5rem] md:w-[calc(100vw-17.5rem)] md:max-w-[calc(100vw-17.5rem)] md:pb-0">
        <Topbar
          userName={preview ? UX_PREVIEW_PERSONAS.internal.name : user!.name}
          userEmail={user?.email}
          preview={preview}
          innovatorPreview={innovatorPreview}
          canViewCompliance={permissions.includes("compliance.view")}
          alerts={alerts}
          developmentRoleOptions={developmentRoleOptions}
        />
        <main className="min-w-0 flex-1 p-4 print:p-0 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
