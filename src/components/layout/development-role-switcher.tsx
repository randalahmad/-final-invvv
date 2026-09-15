"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { MonitorCog } from "lucide-react";

import { switchDevelopmentRoleAction } from "@/modules/auth/actions";
import type { DevelopmentRolePreviewOption } from "@/modules/auth/development-role-preview";

export function DevelopmentRoleSwitcher({ options, activeEmail }: { options: DevelopmentRolePreviewOption[]; activeEmail: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isSwitching, setIsSwitching] = useState(false);
  const currentPath = `${pathname}${searchParams.size ? `?${searchParams.toString()}` : ""}`;

  if (!options.length) return null;

  return (
    <form action={switchDevelopmentRoleAction} className="flex items-center gap-1.5 rounded-lg border border-dashed border-border bg-bg px-2 py-1.5">
      <MonitorCog className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
      <label className="text-[11px] font-semibold text-muted" htmlFor="development-role-preview">معاينة الدور</label>
      <input type="hidden" name="callbackUrl" value={currentPath} />
      <select
        id="development-role-preview"
        name="email"
        defaultValue={activeEmail}
        disabled={isSwitching}
        onChange={(event) => {
          setIsSwitching(true);
          event.currentTarget.form?.requestSubmit();
        }}
        className="max-w-36 bg-transparent text-[12px] font-semibold text-text outline-none disabled:cursor-wait"
        aria-label="تغيير الواجهة وفق الدور"
      >
        {options.map((option) => <option key={option.email} value={option.email}>{option.label}</option>)}
      </select>
    </form>
  );
}
