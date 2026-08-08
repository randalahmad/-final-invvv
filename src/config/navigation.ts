import {
  LayoutDashboard,
  Landmark,
  Lightbulb,
  FolderCheck,
  Target,
  CalendarDays,
  Flag,
  Users,
  ScrollText,
  FileBarChart,
  Bell,
  ClipboardList,
  Building2,
  FileText,
  Handshake,
  Settings,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import type { PermissionKey } from "@/modules/auth/permissions";
import { PREVIEW_PERSONA_PATHS, type PreviewPersonaKey } from "@/lib/ux-preview";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  permissions?: PermissionKey[];
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/** Demo navigation exposes only implemented, reliable stakeholder journeys. */
export const navGroups: NavGroup[] = [
  {
    label: "الرئيسية",
    items: [
      { href: "/dashboard", label: "لوحة العمل", icon: LayoutDashboard },
    ],
  },
  {
    label: "إدارة الابتكار",
    items: [
      { href: "/strategy", label: "الاستراتيجية والخطة السنوية", icon: Target, permissions: ["strategy.objective.view"] },
      { href: "/activities", label: "البرامج والفعاليات", icon: CalendarDays, permissions: ["activity.view"] },
      { href: "/challenges", label: "التحديات", icon: Flag, permissions: ["challenge.view"] },
      { href: "/governance/ideas", label: "بنك الابتكار", icon: Lightbulb, permissions: ["idea.view"] },
      { href: "/solutions", label: "الحلول الابتكارية", icon: Lightbulb, permissions: ["solution.view"] },
    ],
  },
  {
    label: "المتابعة والتقييم",
    items: [
      { href: "/governance", label: "اللجان والتقييمات", icon: Landmark, permissions: ["committee.view", "idea.view"] },
      { href: "/compliance", label: "الجاهزية والامتثال", icon: FolderCheck, permissions: ["compliance.view"] },
    ],
  },
  {
    label: "المتابعة الإدارية",
    items: [
      { href: "/alerts", label: "المهام والتنبيهات", icon: Bell, permissions: ["alert.view"] },
      { href: "/reports", label: "التقارير", icon: FileBarChart, permissions: ["compliance.view"] },
    ],
  },
  {
    label: "إدارة النظام",
    items: [
      { href: "/admin/users", label: "المستخدمون والصلاحيات", icon: Users, permissions: ["user.manage"] },
      { href: "/admin/users/requests", label: "طلبات التسجيل", icon: ClipboardList, permissions: ["user.manage"] },
      { href: "/audit", label: "سجل التدقيق", icon: ScrollText, permissions: ["audit.view"] },
    ],
  },
];

/** Presentation-only filtering; server authorization remains authoritative. */
export function navGroupsForPermissions(permissions: Iterable<PermissionKey>): NavGroup[] {
  const permissionSet = new Set(permissions);
  return navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => !item.permissions?.length || item.permissions.some((permission) => permissionSet.has(permission)),
      ),
    }))
    .filter((group) => group.items.length > 0);
}

const previewOnlyGroups: NavGroup[] = [
  { label: "المتابعة والتقييم", items: [
    { href: "/impact", label: "قياس الأثر", icon: TrendingUp },
    { href: "/evidence", label: "الأدلة والوثائق", icon: FileText },
  ] },
  { label: "العلاقات والتعاون", items: [
    { href: "/partners", label: "الجهات والشركاء", icon: Building2 },
    { href: "/agreements", label: "الاتفاقيات والتعاون", icon: Handshake },
  ] },
  { label: "إدارة النظام", items: [
    { href: "/settings", label: "الإعدادات", icon: Settings },
  ] },
];

export function navGroupsForPreviewPersona(persona: PreviewPersonaKey): NavGroup[] {
  const allowed = new Set(PREVIEW_PERSONA_PATHS[persona]);
  const groups = [...navGroups, ...previewOnlyGroups];
  const order = ["الرئيسية", "إدارة الابتكار", "المتابعة والتقييم", "العلاقات والتعاون", "المتابعة الإدارية", "إدارة النظام"];
  return order.map((label) => ({
    label,
    items: groups.filter((group) => group.label === label).flatMap((group) => group.items).filter((item) => allowed.has(item.href)),
  })).filter((group) => group.items.length > 0);
}

/** Human-readable Arabic titles per route, for the topbar. */
export const routeTitles: Record<string, string> = {
  "/dashboard": "لوحة العمل",
  "/strategy": "الاستراتيجية والخطة السنوية",
  "/activities": "البرامج والفعاليات",
  "/governance/ideas": "بنك الابتكار",
  "/governance": "اللجان والتقييمات",
  "/challenges": "التحديات",
  "/solutions": "الحلول الابتكارية",
  "/impact": "قياس أثر الحلول",
  "/evidence": "الأدلة والوثائق",
  "/partners": "سجل الجهات والشراكات",
  "/agreements": "الاتفاقيات والتعاون",
  "/compliance": "الجاهزية والامتثال",
  "/alerts": "المهام والتنبيهات",
  "/admin/users/requests": "طلبات التسجيل",
  "/admin/users": "المستخدمون والصلاحيات",
  "/audit": "سجل التدقيق",
  "/reports": "التقارير",
  "/settings": "الإعدادات",
};
