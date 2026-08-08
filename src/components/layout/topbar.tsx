"use client";

import Link from "next/link";
import { FolderCheck, LogOut } from "lucide-react";

import { InitialsAvatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/modules/auth/actions";

export function Topbar({ userName }: { userName: string }) {
  return (
    <header className="sticky top-0 z-10 flex items-center justify-end border-b border-border bg-surface px-4 py-3.5 dark:border-border-dark dark:bg-surface-dark sm:px-6 print:hidden">
      <div className="flex min-w-0 items-center gap-2.5">
        <Button asChild variant="outline" size="sm">
          <Link href="/compliance" className="hidden sm:flex">
            <FolderCheck className="h-4 w-4" />
            الجاهزية والامتثال
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
