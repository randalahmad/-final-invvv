"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { UX_PREVIEW_PERSONAS, previewPersonaFromSearch } from "@/lib/ux-preview";

export function PreviewRoleSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const active = previewPersonaFromSearch(searchParams.get("previewRole"));
  const persona = UX_PREVIEW_PERSONAS[active];

  function changeRole(role: string) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("previewRole", previewPersonaFromSearch(role));
    router.replace(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="flex min-w-0 items-center gap-2">
      <div className="hidden text-end sm:block">
        <p className="text-[12px] font-semibold text-slate-700">{persona.name}</p>
        <p className="text-[10.5px] text-muted">{persona.email}</p>
      </div>
      <select
        value={active}
        onChange={(event) => changeRole(event.target.value)}
        aria-label="تبديل شخصية المعاينة"
        className="max-w-[145px] rounded-lg border border-border bg-white px-2.5 py-1.5 text-[12px] font-semibold outline-none focus:border-primary"
      >
        {Object.entries(UX_PREVIEW_PERSONAS).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}
      </select>
    </div>
  );
}
