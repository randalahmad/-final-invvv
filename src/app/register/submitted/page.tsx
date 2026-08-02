import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

import { site } from "@/config/site";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "تم استلام الطلب",
};

export default function RegistrationSubmittedPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-bg px-4">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -end-32 -top-32 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
      </div>

      <div className="relative z-10 flex w-full max-w-md flex-col items-center text-center">
        <div className="card-surface w-full rounded-3xl p-8">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-success-bg">
            <CheckCircle2 className="h-7 w-7 text-success" />
          </div>
          <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100">تم استلام طلب التسجيل</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            طلبك قيد المراجعة من قِبل مدير النظام. لا يمكنك الدخول إلى المنصة حتى يتم اعتماد الحساب.
            سيتم تفعيل حسابك بعد المراجعة.
          </p>
          <Button asChild className="mt-6 w-full">
            <Link href="/login">العودة إلى تسجيل الدخول</Link>
          </Button>
        </div>
        <p className="mt-6 text-xs text-muted">© 2026 {site.name}</p>
      </div>
    </main>
  );
}
