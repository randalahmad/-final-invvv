import type { Metadata } from "next";
import Link from "next/link";

import { site } from "@/config/site";
import { RegisterForm } from "@/modules/registration/components/register-form";

export const metadata: Metadata = {
  title: "إنشاء حساب",
};

export default function RegisterPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-bg px-4 py-10">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -end-32 -top-32 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-32 -start-32 h-96 w-96 rounded-full bg-secondary/10 blur-3xl" />
      </div>

      <div className="relative z-10 flex w-full max-w-lg flex-col items-center">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-extrabold text-slate-800">{site.name}</h1>
          <p className="mt-2 text-sm text-muted">أنشئ حسابًا جديدًا للانضمام إلى المنصة</p>
        </div>

        <div className="card-surface w-full rounded-3xl p-8">
          <RegisterForm />
        </div>

        <p className="mt-6 text-center text-xs text-muted">
          لديك حساب بالفعل؟{" "}
          <Link href="/login" className="font-semibold text-primary hover:underline">
            تسجيل الدخول
          </Link>
        </p>
      </div>
    </main>
  );
}
