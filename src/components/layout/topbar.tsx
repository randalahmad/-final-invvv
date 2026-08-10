"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { Eye, FileBarChart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PreviewRoleSwitcher } from "@/components/layout/preview-role-switcher";
import { buildPreviewHref, permissionsForPreviewPersona, previewPersonaFromSearch } from "@/lib/ux-preview";

const AuthenticatedUserControls = dynamic(() => import("@/components/layout/authenticated-user-controls"), { ssr: false });

export function Topbar({ userName, preview = false, canViewCompliance = false }: { userName: string; preview?: boolean; canViewCompliance?: boolean }) {
  const searchParams = useSearchParams();
  const persona = previewPersonaFromSearch(searchParams.get("previewRole"));
  const showReports = preview ? permissionsForPreviewPersona(persona).includes("compliance.view") : canViewCompliance;
  return <header className="sticky top-0 z-10 flex items-center justify-end border-b border-border bg-surface px-4 py-3.5 dark:border-border-dark dark:bg-surface-dark sm:px-6 print:hidden"><div className="flex min-w-0 items-center gap-2.5">
    {preview && <div className="flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[11.5px] font-semibold text-amber-800 ring-1 ring-amber-200"><Eye className="h-3.5 w-3.5" />وضع معاينة الواجهات</div>}
    {showReports && <Button asChild variant="outline" size="sm"><Link href={preview ? buildPreviewHref("/reports", persona) : "/reports"} className="hidden sm:flex"><FileBarChart className="h-4 w-4" />التقارير / ملف الامتثال</Link></Button>}
    {preview ? <PreviewRoleSwitcher /> : <AuthenticatedUserControls userName={userName} />}
  </div></header>;
}
