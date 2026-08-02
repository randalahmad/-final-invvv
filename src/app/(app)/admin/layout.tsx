import { requirePermission } from "@/server/authz";

/**
 * Server-side guard for the whole /admin subtree. Requires the `user.manage`
 * permission (held by SYSTEM_ADMIN). Unauthenticated → /login; authenticated
 * but unauthorized → FORBIDDEN (nearest error boundary). Never relies on hiding
 * the link in navigation.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requirePermission("user.manage");
  return <>{children}</>;
}
