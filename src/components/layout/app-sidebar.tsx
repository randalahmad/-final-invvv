"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { navGroupsForInnovatorPreview, navGroupsForPermissions, navGroupsForPreviewPersona } from "@/config/navigation";
import { site } from "@/config/site";
import type { PermissionKey } from "@/modules/auth/permissions";
import { previewPersonaFromSearch } from "@/lib/ux-preview";
import { buildPreviewHref } from "@/lib/ux-preview";
import { useSearchParams } from "next/navigation";

export function AppSidebar({
  permissions = [],
  preview = false,
  innovatorPreview = false,
}: {
  permissions?: PermissionKey[];
  preview?: boolean;
  innovatorPreview?: boolean;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const persona = previewPersonaFromSearch(searchParams.get("previewRole"));
  const visibleGroups = innovatorPreview || (preview && persona === "innovator")
    ? navGroupsForInnovatorPreview()
    : preview
    ? navGroupsForPreviewPersona(persona)
    : navGroupsForPermissions(permissions);
  return (
    <aside className="fixed inset-x-0 bottom-0 z-30 flex h-[4.5rem] w-full shrink-0 flex-row overflow-x-auto border-t border-border bg-gradient-sidebar px-2 py-2 text-slate-600 shadow-[0_-8px_25px_rgba(15,23,42,0.08)] print:hidden md:sticky md:top-0 md:h-screen md:w-[17.5rem] md:flex-col md:overflow-y-auto md:overflow-x-hidden md:border-l md:border-t-0 md:px-4 md:py-5 md:shadow-none">
      <div className="mb-4 hidden border-b border-border px-2 pb-5 pt-1 md:block">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary-50 text-xs font-bold text-primary ring-1 ring-primary/10">كـ</div>
          <div>
            <div className="text-sm font-bold text-foreground">{site.shortName}</div>
            <div className="mt-0.5 text-[10px] font-medium tracking-wide text-muted">منصة مؤسسية للجاهزية والابتكار</div>
          </div>
        </div>
        <div className="mt-3 hidden text-[11px] leading-relaxed text-muted md:block">
          {site.owner}
          <br />
          {site.ownerUnit}
        </div>
      </div>

      <nav className="flex min-w-max flex-row gap-1 md:min-w-0 md:flex-col md:gap-1.5">
        {visibleGroups.map((group) => {
          return (
          <div key={group.label} className="contents md:block">
            <div className="hidden px-3 pb-1.5 pt-4 text-[10px] font-semibold tracking-wide text-muted md:block">{group.label}</div>
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
                    "mb-0.5 flex h-12 w-12 shrink-0 items-center justify-center gap-2.5 rounded-xl px-2 py-2.5 text-[13px] transition-all md:h-auto md:w-auto md:justify-start md:px-3.5 md:py-3",
                    active
                      ? "bg-primary-50 font-semibold text-primary ring-1 ring-primary/10"
                      : "text-foreground-secondary hover:bg-primary-50/70 hover:text-primary",
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
