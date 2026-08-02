"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FolderCheck, LogOut } from "lucide-react";

import { routeTitles } from "@/config/navigation";
import { InitialsAvatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/modules/auth/actions";

function titleFor(pathname: string): string {
  const match = Object.keys(routeTitles)
    .filter((r) => pathname === r || pathname.startsWith(r + "/"))
    .sort((a, b) => b.length - a.length)[0];
  return match ? routeTitles[match] : "";
}

export function Topbar({ userName }: { userName: string }) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-surface px-7 py-3.5 dark:border-border-dark dark:bg-surface-dark print:hidden">
      <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100">{titleFor(pathname)}</h1>

      <div className="flex items-center gap-2.5">
        <Button asChild variant="outline" size="sm">
          <Link href="/compliance">
            <FolderCheck className="h-4 w-4" />
            ملف الامتثال
          </Link>
        </Button>

        <div className="flex items-center gap-2 ps-1">
          <InitialsAvatar name={userName} className="h-9 w-9" />
          <span className="hidden text-sm font-semibold text-slate-700 sm:block dark:text-slate-200">
            {userName}
          </span>
        </div>

        <form action={logoutAction}>
          <Button type="submit" variant="ghost" size="icon" aria-label="تسجيل الخروج">
            <LogOut className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </header>
  );
}
