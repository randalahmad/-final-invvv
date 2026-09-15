"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { Eye, FileBarChart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PreviewRoleSwitcher } from "@/components/layout/preview-role-switcher";
import { DevelopmentRoleSwitcher } from "@/components/layout/development-role-switcher";
import type { DevelopmentRolePreviewOption } from "@/modules/auth/development-role-preview";
import { buildPreviewHref, permissionsForPreviewPersona, previewPersonaFromSearch } from "@/lib/ux-preview";
import { NotificationMenu } from "@/modules/alerts/components/notification-menu";
import type { AlertItemData } from "@/modules/alerts/types";

const AuthenticatedUserControls = dynamic(() => import("@/components/layout/authenticated-user-controls"), { ssr: false });

export function Topbar({ userName, userEmail = "", preview = false, canViewCompliance = false, alerts = [], developmentRoleOptions = [] }: { userName: string; userEmail?: string; preview?: boolean; canViewCompliance?: boolean; alerts?: AlertItemData[]; developmentRoleOptions?: DevelopmentRolePreviewOption[] }) {
  const searchParams = useSearchParams();
  const persona = previewPersonaFromSearch(searchParams.get("previewRole"));
  const showReports = preview ? permissionsForPreviewPersona(persona).includes("compliance.view") : canViewCompliance;
  return <header className="sticky top-0 z-10 flex min-h-[4.75rem] items-center justify-between border-b border-border/80 bg-surface/90 px-4 py-3 backdrop-blur-md dark:border-border-dark dark:bg-surface-dark/90 sm:px-6 lg:px-8 print:hidden"><div className="hidden min-w-0 sm:block"><p className="text-[11px] font-semibold tracking-wide text-primary">مدينة الملك عبدالله للطاقة الذرية والمتجددة</p><p className="mt-0.5 text-xs text-muted">منصة إدارة الابتكار المؤسسي</p></div><div className="flex min-w-0 items-center gap-2.5">
    {preview && <div className="flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[11.5px] font-semibold text-amber-800 ring-1 ring-amber-200"><Eye className="h-3.5 w-3.5" />وضع معاينة الواجهات</div>}
    {showReports && <Button asChild variant="outline" size="sm"><Link href={preview ? buildPreviewHref("/reports", persona) : "/reports"} className="hidden sm:flex"><FileBarChart className="h-4 w-4" />التقارير / ملف الامتثال</Link></Button>}
    {!preview && <NotificationMenu alerts={alerts} />}
    {!preview && <DevelopmentRoleSwitcher options={developmentRoleOptions} activeEmail={userEmail} />}
    {preview ? <PreviewRoleSwitcher /> : <AuthenticatedUserControls userName={userName} />}
  </div></header>;
}
