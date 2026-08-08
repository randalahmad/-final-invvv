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
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
  ideaAccessOnly?: boolean;
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
      { href: "/strategy", label: "الاستراتيجية والخطة السنوية", icon: Target },
      { href: "/activities", label: "البرامج والفعاليات", icon: CalendarDays },
      { href: "/challenges", label: "التحديات", icon: Flag },
      { href: "/governance/ideas", label: "بنك الابتكار", icon: Lightbulb, ideaAccessOnly: true },
      { href: "/solutions", label: "الحلول الابتكارية", icon: Lightbulb },
    ],
  },
  {
    label: "المتابعة والتقييم",
    items: [
      { href: "/governance", label: "اللجان والتقييمات", icon: Landmark },
      { href: "/compliance", label: "الجاهزية والامتثال", icon: FolderCheck },
    ],
  },
  {
    label: "المتابعة الإدارية",
    items: [
      { href: "/alerts", label: "المهام والتنبيهات", icon: Bell },
      { href: "/reports", label: "التقارير", icon: FileBarChart },
    ],
  },
  {
    label: "إدارة النظام",
    items: [
      { href: "/admin/users", label: "المستخدمون والصلاحيات", icon: Users, adminOnly: true },
      { href: "/admin/users/requests", label: "طلبات التسجيل", icon: ClipboardList, adminOnly: true },
      { href: "/audit", label: "سجل التدقيق", icon: ScrollText, adminOnly: true },
    ],
  },
];

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
  "/partners": "سجل الجهات والشراكات",
  "/compliance": "الجاهزية والامتثال",
  "/alerts": "المهام والتنبيهات",
  "/admin/users/requests": "طلبات التسجيل",
  "/admin/users": "المستخدمون والصلاحيات",
  "/audit": "سجل التدقيق",
  "/reports": "التقارير",
};
