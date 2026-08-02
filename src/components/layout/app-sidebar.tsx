"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ShieldCheck, Lightbulb } from "lucide-react";

import { cn } from "@/lib/utils";
import { navGroups } from "@/config/navigation";
import { site } from "@/config/site";

export function AppSidebar({
  isAdmin = false,
  canViewIdeas = false,
}: {
  isAdmin?: boolean;
  canViewIdeas?: boolean;
}) {
  const pathname = usePathname();
  const adminActive = pathname.startsWith("/admin");
  const ideasActive = pathname.startsWith("/governance/ideas");

  return (
    <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col overflow-y-auto bg-gradient-sidebar px-3.5 py-4 text-slate-200 print:hidden">
      {/* Brand — temporary text-based identity */}
      <div className="mb-3.5 border-b border-white/10 px-2 pb-4 pt-1.5">
        <div className="text-[14.5px] font-bold text-white">{site.name}</div>
        <div className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
          {site.owner}
          <br />
          {site.ownerUnit}
        </div>
      </div>

      <nav className="flex flex-col gap-1">
        {navGroups.map((group) => (
          <div key={group.label}>
            <div className="px-2.5 pb-1.5 pt-3.5 text-[10.5px] text-slate-400">{group.label}</div>
            {group.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "mb-0.5 flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13.3px] transition-colors",
                    active
                      ? "bg-secondary font-semibold text-white shadow-lg shadow-secondary/30"
                      : "text-slate-300 hover:bg-white/5 hover:text-white",
                  )}
                >
                  <Icon className="h-[18px] w-[18px] shrink-0" />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
            {canViewIdeas && group.label === "مسار العرض التشغيلي" && (
              <Link
                href="/governance/ideas"
                aria-current={ideasActive ? "page" : undefined}
                className={cn(
                  "mb-0.5 flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13.3px] transition-colors",
                  ideasActive
                    ? "bg-secondary font-semibold text-white shadow-lg shadow-secondary/30"
                    : "text-slate-300 hover:bg-white/5 hover:text-white",
                )}
              >
                <Lightbulb className="h-[18px] w-[18px] shrink-0" />
                <span className="truncate">الأفكار</span>
              </Link>
            )}
          </div>
        ))}

        {isAdmin && (
          <div>
            <div className="px-2.5 pb-1.5 pt-3.5 text-[10.5px] text-slate-400">إدارة النظام</div>
            <Link
              href="/admin/users/requests"
              aria-current={adminActive ? "page" : undefined}
              className={cn(
                "mb-0.5 flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13.3px] transition-colors",
                adminActive
                  ? "bg-secondary font-semibold text-white shadow-lg shadow-secondary/30"
                  : "text-slate-300 hover:bg-white/5 hover:text-white",
              )}
            >
              <ShieldCheck className="h-[18px] w-[18px] shrink-0" />
              <span className="truncate">طلبات التسجيل والحسابات</span>
            </Link>
          </div>
        )}
      </nav>
    </aside>
  );
}
