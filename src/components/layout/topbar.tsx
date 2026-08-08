"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Eye, FolderCheck, LogOut } from "lucide-react";

import { InitialsAvatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/modules/auth/actions";
import { PreviewRoleSwitcher } from "@/components/layout/preview-role-switcher";
import { permissionsForPreviewPersona, previewPersonaFromSearch } from "@/lib/ux-preview";

export function Topbar({ userName, preview = false, canViewCompliance = false }: { userName: string; preview?: boolean; canViewCompliance?: boolean }) {
  const searchParams = useSearchParams();
  const showCompliance = preview
    ? permissionsForPreviewPersona(previewPersonaFromSearch(searchParams.get("previewRole"))).includes("compliance.view")
    : canViewCompliance;
  return (
    <header className="sticky top-0 z-10 flex items-center justify-end border-b border-border bg-surface px-4 py-3.5 dark:border-border-dark dark:bg-surface-dark sm:px-6 print:hidden">
      <div className="flex min-w-0 items-center gap-2.5">
        {preview && (
          <div className="flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[11.5px] font-semibold text-amber-800 ring-1 ring-amber-200">
            <Eye className="h-3.5 w-3.5" />
            وضع معاينة الواجهات
          </div>
        )}
        {showCompliance && <Button asChild variant="outline" size="sm">
          <Link href="/compliance" className="hidden sm:flex">
            <FolderCheck className="h-4 w-4" />
            الجاهزية والامتثال
          </Link>
        </Button>}

        {preview ? <PreviewRoleSwitcher /> : <div className="flex items-center gap-2 ps-1">
          <InitialsAvatar name={userName} className="h-9 w-9" />
          <span className="hidden text-sm font-semibold text-slate-700 sm:block dark:text-slate-200">
            {userName}
          </span>
        </div>}

        {!preview && <form action={logoutAction}>
          <Button type="submit" variant="ghost" size="icon" aria-label="تسجيل الخروج">
            <LogOut className="h-4 w-4" />
          </Button>
        </form>}
      </div>
    </header>
  );
}
