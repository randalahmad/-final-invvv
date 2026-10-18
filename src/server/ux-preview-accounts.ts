import type { PreviewPersonaKey } from "@/lib/ux-preview";

export const UX_PREVIEW_SESSION_COOKIE = "ux-preview-session";

type PreviewAccount = {
  name: string;
  roleLabel: string;
  email: string;
  password: string;
  persona: PreviewPersonaKey;
  token: string;
};

/**
 * Isolated fixture accounts for UX Preview only. They never create or update
 * database users and are unreachable unless UX Preview Mode is active.
 */
export const UX_PREVIEW_ACCOUNTS: readonly PreviewAccount[] = [
  { name: "مدير النظام", roleLabel: "مدير النظام", email: "admin@innovation.local", password: "Admin@12345", persona: "admin", token: "uxp_7fc546909b434ea0_admin" },
  { name: "محرر الابتكار الداخلي", roleLabel: "محرر داخلي", email: "editor@innovation.local", password: "Demo@12345", persona: "internal", token: "uxp_62f46bd647f84db0_internal" },
  { name: "سارة المبتكرة", roleLabel: "مبتكر", email: "innovator@innovation.local", password: "Demo@12345", persona: "innovator", token: "uxp_7d2d57c886654338_innovator" },
  { name: "منسق الشراكة الخارجية", roleLabel: "شريك خارجي", email: "partner@innovation.local", password: "Demo@12345", persona: "partner", token: "uxp_9e720936b96b444a_partner" },
  { name: "مطّلع", roleLabel: "مطّلع", email: "viewer@innovation.local", password: "Demo@12345", persona: "viewer", token: "uxp_a61a4b75a46c418d_viewer" },
] as const;

export function authenticateUxPreviewAccount(email: string, password: string): PreviewAccount | null {
  const normalizedEmail = email.trim().toLowerCase();
  return UX_PREVIEW_ACCOUNTS.find((account) => account.email === normalizedEmail && account.password === password) ?? null;
}

export function uxPreviewAccountFromToken(token: string | undefined): PreviewAccount | null {
  if (!token) return null;
  return UX_PREVIEW_ACCOUNTS.find((account) => account.token === token) ?? null;
}
