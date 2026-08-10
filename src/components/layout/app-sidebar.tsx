"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { navGroupsForPermissions, navGroupsForPreviewPersona } from "@/config/navigation";
import { site } from "@/config/site";
import type { PermissionKey } from "@/modules/auth/permissions";
import { previewPersonaFromSearch } from "@/lib/ux-preview";
import { buildPreviewHref } from "@/lib/ux-preview";
import { useSearchParams } from "next/navigation";

export function AppSidebar({
  permissions = [],
  preview = false,
}: {
  permissions?: PermissionKey[];
  preview?: boolean;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const persona = previewPersonaFromSearch(searchParams.get("previewRole"));
  const visibleGroups = preview
    ? navGroupsForPreviewPersona(persona)
    : navGroupsForPermissions(permissions);
  return (
    <aside className="fixed inset-x-0 bottom-0 z-30 flex h-16 w-full shrink-0 flex-row overflow-x-auto bg-gradient-sidebar px-2 py-2 text-slate-200 print:hidden md:sticky md:top-0 md:h-screen md:w-64 md:flex-col md:overflow-y-auto md:overflow-x-hidden md:px-3.5 md:py-4">
      {/* Brand — temporary text-based identity */}
      <div className="mb-3.5 hidden border-b border-white/10 px-1 pb-4 pt-1.5 text-center md:block md:px-2 md:text-start">
        <div className="text-sm font-bold text-white md:text-[14.5px]">{site.shortName}</div>
        <div className="mt-1.5 hidden text-[11px] leading-relaxed text-slate-400 md:block">
          {site.owner}
          <br />
          {site.ownerUnit}
        </div>
      </div>

      <nav className="flex min-w-max flex-row gap-1 md:min-w-0 md:flex-col">
        {visibleGroups.map((group) => {
          return (
          <div key={group.label} className="contents md:block">
            <div className="hidden px-2.5 pb-1.5 pt-3.5 text-[10.5px] text-slate-400 md:block">{group.label}</div>
            {group.items.map((item) => {
              const exactOnly = item.href === "/governance" || item.href === "/admin/users";
              const active = pathname === item.href || (!exactOnly && pathname.startsWith(item.href + "/"));
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={preview ? buildPreviewHref(item.href, persona) : item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "mb-0.5 flex h-12 w-12 shrink-0 items-center justify-center gap-2.5 rounded-lg px-2 py-2.5 text-[13.3px] transition-colors md:h-auto md:w-auto md:justify-start md:px-3",
                    active
                      ? "bg-secondary font-semibold text-white shadow-lg shadow-secondary/30"
                      : "text-slate-300 hover:bg-white/5 hover:text-white",
                  )}
                >
                  <Icon className="h-[18px] w-[18px] shrink-0" />
                  <span className="hidden truncate md:inline">{item.label}</span>
                </Link>
              );
            })}
          </div>
        )})}
      </nav>
    </aside>
  );
}
