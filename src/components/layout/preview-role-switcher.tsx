"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { buildPreviewHref, canPreviewPersonaAccessPath, UX_PREVIEW_PERSONAS, previewPersonaFromSearch } from "@/lib/ux-preview";
import { PREVIEW_INNOVATOR_STORAGE_KEY, readPreviewInnovators } from "@/modules/ux-preview/innovator-accounts";

export function PreviewRoleSwitcher() {
  const searchParams = useSearchParams();
  const active = previewPersonaFromSearch(searchParams.get("previewRole"));
  const persona = UX_PREVIEW_PERSONAS[active];
  const previewAccount = searchParams.get("previewAccount");
  const [account, setAccount] = useState<{name:string;email:string}|null>(null);
  useEffect(() => { if (active !== "innovator" || !previewAccount) { setAccount(null); return; } setAccount(readPreviewInnovators(window.localStorage.getItem(PREVIEW_INNOVATOR_STORAGE_KEY)).find((item) => item.id === previewAccount) ?? null); }, [active, previewAccount]);
  function changeRole(role: string) { const selected = previewPersonaFromSearch(role); const next = new URL(window.location.href); next.search = ""; if (!canPreviewPersonaAccessPath(selected, next.pathname)) next.pathname = selected === "innovator" ? "/journey" : "/dashboard"; window.location.assign(buildPreviewHref(next.pathname, selected, selected === "innovator" ? previewAccount : null)); }
  return <div className="flex min-w-0 items-center gap-2"><div className="hidden text-end sm:block"><p className="text-[12px] font-semibold text-slate-700">{account?.name ?? persona.name}</p><p className="text-[10.5px] text-muted">{account?.email ?? persona.email}</p></div><select data-testid="active-preview-persona" data-preview-persona={active} value={active} onChange={(event) => changeRole(event.target.value)} aria-label="تبديل شخصية المعاينة" className="max-w-[145px] rounded-lg border border-border bg-white px-2.5 py-1.5 text-[12px] font-semibold outline-none focus:border-primary">{Object.entries(UX_PREVIEW_PERSONAS).map(([key,item])=><option key={key} value={key}>{item.label}</option>)}</select></div>;
}
