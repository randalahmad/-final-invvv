import { DEFAULT_ROLE_PERMISSIONS, ROLE_KEYS, type PermissionKey } from "@/modules/auth/permissions";

export function isUxPreviewMode(): boolean { return process.env.UX_PREVIEW_MODE === "true" && process.env.VERCEL_ENV !== "production"; }
export const UX_PREVIEW_PERSONAS = {
  admin: { label: "مدير النظام", name: "مدير النظام", email: "admin@innovation.local", role: ROLE_KEYS.SYSTEM_ADMIN },
  internal: { label: "محرر داخلي", name: "محرر الابتكار الداخلي", email: "editor@innovation.local", role: ROLE_KEYS.INTERNAL_EDITOR },
  partner: { label: "شريك خارجي", name: "منسق الشراكة الخارجية", email: "partner@innovation.local", role: ROLE_KEYS.EXTERNAL_PARTNER },
  viewer: { label: "مطّلع", name: "مطّلع", email: "viewer@innovation.local", role: ROLE_KEYS.VIEWER },
} as const;
export type PreviewPersonaKey = keyof typeof UX_PREVIEW_PERSONAS;
export function buildPreviewHref(path: string, persona: PreviewPersonaKey): string { const [pathname, query = ""] = path.split("?"); const params = new URLSearchParams(query); params.set("previewRole", persona); return `${pathname}?${params.toString()}`; }
export const PREVIEW_PERSONA_PATHS: Record<PreviewPersonaKey, readonly string[]> = {
  admin: ["/dashboard", "/strategy", "/activities", "/governance", "/solutions", "/impact", "/my-tasks", "/reviews", "/evidence-matrix", "/readiness-check", "/compliance", "/alerts", "/reports", "/account", "/admin/users", "/audit", "/settings"],
  internal: ["/dashboard", "/strategy", "/activities", "/governance", "/solutions", "/impact", "/my-tasks", "/evidence-matrix", "/readiness-check", "/compliance", "/alerts", "/reports", "/account"],
  partner: ["/dashboard", "/strategy", "/activities", "/solutions", "/impact", "/my-tasks", "/evidence-matrix", "/account"],
  viewer: ["/dashboard", "/solutions", "/impact", "/compliance", "/reports", "/account"],
};
export function previewPersonaFromSearch(value: string | null | undefined): PreviewPersonaKey { return value && value in UX_PREVIEW_PERSONAS ? (value as PreviewPersonaKey) : "internal"; }
export function permissionsForPreviewPersona(key: PreviewPersonaKey): PermissionKey[] { return DEFAULT_ROLE_PERMISSIONS[UX_PREVIEW_PERSONAS[key].role]; }
export function canPreviewPersonaAccessPath(key: PreviewPersonaKey, path: string): boolean { if (path === "/") return true; return PREVIEW_PERSONA_PATHS[key].some((base) => path === base || path.startsWith(`${base}/`)); }
