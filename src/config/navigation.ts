import { Activity, BarChart3, Bell, ClipboardCheck, FileCheck2, FolderSearch, Gauge, Landmark, ListTodo, ScrollText, Settings, ShieldCheck, Target, TrendingUp, UserCircle, Users, type LucideIcon } from "lucide-react";
import type { PermissionKey } from "@/modules/auth/permissions";
import { PREVIEW_PERSONA_PATHS, type PreviewPersonaKey } from "@/lib/ux-preview";

export interface NavItem { href: string; label: string; icon: LucideIcon; permissions?: PermissionKey[]; }
export interface NavGroup { label: string; items: NavItem[]; }

export const navGroups: NavGroup[] = [
  { label: "الجاهزية المؤسسية", items: [
    { href: "/dashboard", label: "الرئيسية", icon: Gauge },
    { href: "/strategy", label: "التوجه الاستراتيجي", icon: Target, permissions: ["strategy.objective.view"] },
    { href: "/activities", label: "منهجيات الابتكار", icon: Activity, permissions: ["activity.view"] },
    { href: "/governance", label: "حوكمة وتفعيل الابتكار", icon: Landmark, permissions: ["committee.view", "idea.view"] },
    { href: "/solutions", label: "حصر الحلول الابتكارية", icon: FileCheck2, permissions: ["solution.view"] },
    { href: "/impact", label: "قياس أثر الحلول", icon: TrendingUp, permissions: ["impact.view"] },
  ] },
  { label: "المتابعة", items: [
    { href: "/my-tasks", label: "مهامي", icon: ListTodo, permissions: ["compliance.view"] },
    { href: "/reviews", label: "مركز المراجعات والاعتمادات", icon: ClipboardCheck, permissions: ["evidence.approve", "compliance.configure"] },
    { href: "/evidence-matrix", label: "مصفوفة أدلة القياس", icon: FolderSearch, permissions: ["evidence.view"] },
    { href: "/evidence-repository", label: "مستودع الأدلة", icon: FolderSearch, permissions: ["evidence.view"] },
    { href: "/readiness-check", label: "فحص الجاهزية", icon: ShieldCheck, permissions: ["compliance.view"] },
    { href: "/alerts", label: "التنبيهات", icon: Bell, permissions: ["alert.view"] },
    { href: "/reports", label: "التقارير / ملف الامتثال", icon: BarChart3, permissions: ["compliance.view"] },
    { href: "/account", label: "حسابي", icon: UserCircle },
  ] },
  { label: "إدارة النظام", items: [
    { href: "/admin/users", label: "المستخدمون والصلاحيات", icon: Users, permissions: ["user.manage"] },
    { href: "/audit", label: "سجل التدقيق", icon: ScrollText, permissions: ["audit.view"] },
    { href: "/settings", label: "إعدادات النظام", icon: Settings, permissions: ["user.manage"] },
  ] },
];

export function navGroupsForPermissions(permissions: Iterable<PermissionKey>): NavGroup[] {
  const permissionSet = new Set(permissions);
  return navGroups.map((group) => ({ ...group, items: group.items.filter((item) => !item.permissions?.length || item.permissions.some((permission) => permissionSet.has(permission))) })).filter((group) => group.items.length > 0);
}
export function navGroupsForPreviewPersona(persona: PreviewPersonaKey): NavGroup[] {
  const allowed = new Set(PREVIEW_PERSONA_PATHS[persona]);
  return navGroups.map((group) => ({ ...group, items: group.items.filter((item) => allowed.has(item.href)) })).filter((group) => group.items.length > 0);
}
export const routeTitles: Record<string, string> = { "/dashboard": "الرئيسية", "/strategy": "التوجه الاستراتيجي", "/activities": "منهجيات الابتكار", "/governance": "حوكمة وتفعيل الابتكار", "/solutions": "حصر الحلول الابتكارية", "/impact": "قياس أثر الحلول", "/partners": "الجهات والشراكات", "/challenges": "التحديات", "/my-tasks": "مهامي", "/reviews": "مركز المراجعات والاعتمادات", "/evidence-matrix": "مصفوفة أدلة القياس", "/evidence-repository": "مستودع الأدلة", "/readiness-check": "فحص الجاهزية", "/alerts": "التنبيهات", "/reports": "التقارير / ملف الامتثال", "/account": "حسابي", "/admin/users": "المستخدمون والصلاحيات", "/audit": "سجل التدقيق", "/settings": "إعدادات النظام" };
