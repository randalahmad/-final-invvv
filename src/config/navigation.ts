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
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/** Demo navigation exposes only implemented, reliable stakeholder journeys. */
export const navGroups: NavGroup[] = [
  {
    label: "مسار العرض التشغيلي",
    items: [
      { href: "/dashboard", label: "لوحة التحكم", icon: LayoutDashboard },
      { href: "/strategy", label: "التوجه الاستراتيجي", icon: Target },
      { href: "/activities", label: "منهجيات الابتكار وفعالياته", icon: CalendarDays },
      { href: "/governance", label: "حوكمة الابتكار", icon: Landmark },
      { href: "/challenges", label: "إدارة التحديات", icon: Flag },
      { href: "/solutions", label: "الحلول الابتكارية والأدلة", icon: Lightbulb },
      { href: "/compliance", label: "ملف الامتثال", icon: FolderCheck },
      { href: "/alerts", label: "التنبيهات", icon: Bell },
    ],
  },
  {
    label: "الإدارة",
    items: [
      { href: "/admin/users", label: "المستخدمون والصلاحيات", icon: Users },
      { href: "/audit", label: "سجل التدقيق", icon: ScrollText },
      { href: "/reports", label: "التقارير", icon: FileBarChart },
    ],
  },
];

/** Human-readable Arabic titles per route, for the topbar. */
export const routeTitles: Record<string, string> = {
  "/dashboard": "لوحة المؤشرات العامة",
  "/strategy": "التوجه الاستراتيجي",
  "/activities": "منهجيات الابتكار وفعالياته",
  "/governance": "حوكمة الابتكار — من الفكرة إلى الاعتماد",
  "/solutions": "السجل الرئيسي للحلول الابتكارية",
  "/impact": "قياس أثر الحلول",
  "/partners": "سجل الجهات والشراكات",
  "/compliance": "ملف الامتثال",
  "/alerts": "التنبيهات",
};
