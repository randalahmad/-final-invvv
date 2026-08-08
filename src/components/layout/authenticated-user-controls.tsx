"use client";

import { LogOut } from "lucide-react";

import { InitialsAvatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/modules/auth/actions";

export default function AuthenticatedUserControls({ userName }: { userName: string }) {
  return (
    <>
      <div className="flex items-center gap-2 ps-1">
        <InitialsAvatar name={userName} className="h-9 w-9" />
        <span className="hidden text-sm font-semibold text-slate-700 sm:block dark:text-slate-200">{userName}</span>
      </div>
      <form action={logoutAction}>
        <Button type="submit" variant="ghost" size="icon" aria-label="تسجيل الخروج">
          <LogOut className="h-4 w-4" />
        </Button>
      </form>
    </>
  );
}
