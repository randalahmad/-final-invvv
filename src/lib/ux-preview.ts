import { DEFAULT_ROLE_PERMISSIONS, ROLE_KEYS, type PermissionKey } from "@/modules/auth/permissions";

/** Explicit, non-production switch for stakeholder interface review. */
export function isUxPreviewMode(): boolean {
  return process.env.UX_PREVIEW_MODE === "true" && process.env.VERCEL_ENV !== "production";
}

export const UX_PREVIEW_PERSONAS = {
  admin: { label: "مدير النظام", name: "مدير النظام", email: "admin@innovation.local", role: ROLE_KEYS.SYSTEM_ADMIN },
  internal: { label: "مسؤول الابتكار", name: "مسؤول الابتكار الداخلي", email: "editor@innovation.local", role: ROLE_KEYS.INTERNAL_EDITOR },
  partner: { label: "شريك خارجي", name: "منسّق الشراكة الخارجية", email: "partner@innovation.local", role: ROLE_KEYS.EXTERNAL_PARTNER },
  viewer: { label: "مطّلع / قيادة", name: "مطّلع قيادي", email: "viewer@innovation.local", role: ROLE_KEYS.VIEWER },
} as const;

export type PreviewPersonaKey = keyof typeof UX_PREVIEW_PERSONAS;

export const PREVIEW_PERSONA_PATHS: Record<PreviewPersonaKey, readonly string[]> = {
  admin: ["/dashboard", "/strategy", "/activities", "/challenges", "/governance/ideas", "/solutions", "/governance", "/impact", "/evidence", "/compliance", "/partners", "/agreements", "/alerts", "/reports", "/admin/users", "/admin/users/requests", "/audit", "/settings"],
  internal: ["/dashboard", "/strategy", "/activities", "/challenges", "/governance/ideas", "/solutions", "/governance", "/impact", "/evidence", "/compliance", "/partners", "/agreements", "/alerts", "/reports"],
  partner: ["/dashboard", "/solutions", "/evidence", "/partners", "/agreements", "/alerts"],
  viewer: ["/dashboard", "/strategy", "/activities", "/solutions", "/impact", "/compliance", "/reports"],
};

export function previewPersonaFromSearch(value: string | null | undefined): PreviewPersonaKey {
  return value && value in UX_PREVIEW_PERSONAS ? (value as PreviewPersonaKey) : "internal";
}

export function permissionsForPreviewPersona(key: PreviewPersonaKey): PermissionKey[] {
  return DEFAULT_ROLE_PERMISSIONS[UX_PREVIEW_PERSONAS[key].role];
}

/** Preview-only route guard used to keep persona switching out of dead-end screens. */
export function canPreviewPersonaAccessPath(key: PreviewPersonaKey, path: string): boolean {
  if (path === "/") return true;
  return PREVIEW_PERSONA_PATHS[key].some((base) => path === base || path.startsWith(`${base}/`));
}
