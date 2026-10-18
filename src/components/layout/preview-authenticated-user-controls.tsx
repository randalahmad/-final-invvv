"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LogOut } from "lucide-react";

import { UX_PREVIEW_PERSONAS, previewPersonaFromSearch } from "@/lib/ux-preview";

export function PreviewAuthenticatedUserControls() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, setPending] = useState(false);
  const persona = UX_PREVIEW_PERSONAS[previewPersonaFromSearch(searchParams.get("previewRole"))];

  async function logout() {
    setPending(true);
    await fetch("/api/ux-preview/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return <div className="flex min-w-0 items-center gap-2">
    <div className="hidden text-end sm:block"><p className="text-[12px] font-semibold text-slate-700">{persona.name}</p><p className="text-[10.5px] text-muted">{persona.email}</p></div>
    <button type="button" onClick={logout} disabled={pending} aria-label="تسجيل الخروج" className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-white text-muted transition hover:border-primary/30 hover:text-primary disabled:opacity-50"><LogOut className="h-4 w-4" /></button>
  </div>;
}
