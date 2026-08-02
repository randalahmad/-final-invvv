import type { Metadata } from "next";
import Link from "next/link";

import { site } from "@/config/site";
import { LoginForm } from "@/modules/auth/components/login-form";

export const metadata: Metadata = {
  title: "تسجيل الدخول",
};

export default function LoginPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-bg px-4">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -end-32 -top-32 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-32 -start-32 h-96 w-96 rounded-full bg-secondary/10 blur-3xl" />
      </div>

      <div className="relative z-10 flex w-full max-w-md flex-col items-center">
        {/* Temporary text-based identity — no logo */}
        <div className="mb-8 text-center">
          <h1 className="text-xl font-extrabold text-slate-800">{site.name}</h1>
          <p className="mt-2 text-sm text-muted">سجّل الدخول لمتابعة الابتكار والامتثال</p>
        </div>

        <div className="card-surface w-full rounded-3xl p-8">
          <LoginForm />
        </div>

        <p className="mt-6 text-center text-xs text-muted">
          ليس لديك حساب؟{" "}
          <Link href="/register" className="font-semibold text-primary hover:underline">
            إنشاء حساب جديد
          </Link>
        </p>
        <p className="mt-2 text-center text-xs text-muted">© 2026 {site.name} — جميع الحقوق محفوظة</p>
      </div>
    </main>
  );
}
