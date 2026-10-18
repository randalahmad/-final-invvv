import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpLeft, BarChart3, Lightbulb, Route, ShieldCheck, Sparkles } from "lucide-react";

import { site } from "@/config/site";
import { LoginForm } from "@/modules/auth/components/login-form";
import { PreviewLoginForm } from "@/modules/auth/components/preview-login-form";
import { isUxPreviewMode } from "@/lib/ux-preview";
import { DevelopmentPreviewEntry } from "@/modules/auth/components/development-preview-entry";
import { isDevelopmentRolePreviewEnabled } from "@/modules/auth/development-role-preview";

export const metadata: Metadata = { title: "تسجيل الدخول" };

const capabilities = [
  { icon: Route, label: "إدارة رحلة الابتكار" },
  { icon: ShieldCheck, label: "الجاهزية والامتثال" },
  { icon: BarChart3, label: "قياس الأثر" },
];

export default function LoginPage() {
  const preview = isUxPreviewMode();
  if (isDevelopmentRolePreviewEnabled()) return <DevelopmentPreviewEntry />;

  return <main dir="rtl" className="min-h-screen bg-white lg:grid lg:grid-cols-[55%_45%]">
    <section className="relative flex min-h-[42vh] overflow-hidden bg-gradient-to-br from-primary-700 via-primary to-secondary-600 px-6 py-12 text-white sm:px-10 lg:min-h-screen lg:items-center lg:px-16 xl:px-24">
      <div className="pointer-events-none absolute inset-0 opacity-60" aria-hidden="true">
        <div className="absolute -right-32 -top-28 h-96 w-96 rounded-full border border-white/20 bg-white/10 blur-sm" />
        <div className="absolute left-[8%] top-[14%] h-48 w-48 rounded-full border border-white/15" />
        <div className="absolute -bottom-24 left-[18%] h-80 w-80 rounded-full bg-secondary-300/25 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,.15)_1px,transparent_1px)] bg-[size:28px_28px] [mask-image:linear-gradient(to_bottom,black,transparent_78%)]" />
      </div>

      <div className="relative z-10 max-w-2xl">
        <div className="mb-10 inline-flex items-center gap-3 rounded-2xl border border-white/20 bg-white/10 px-4 py-3 backdrop-blur-sm">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-white text-primary shadow-lg"><Lightbulb className="h-5 w-5" /></span>
          <span><b className="block text-sm">{site.name}</b><small className="text-white/70">الابتكار المؤسسي بوضوح وفاعلية</small></span>
        </div>
        <div className="flex items-center gap-2 text-sm font-semibold text-white/75"><Sparkles className="h-4 w-4" /> منظومة واحدة للابتكار المؤسسي</div>
        <h1 className="mt-4 text-4xl font-black leading-tight sm:text-5xl xl:text-6xl">من الفكرة إلى الأثر</h1>
        <p className="mt-5 max-w-xl text-base leading-8 text-white/80 sm:text-lg">منصة متكاملة لإدارة الابتكار المؤسسي، وتمكين المبتكرين، ومتابعة الحلول وقياس أثرها.</p>
        <div className="mt-10 grid gap-3 sm:grid-cols-3">{capabilities.map(({ icon: Icon, label }) => <div key={label} className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 p-4 text-sm font-semibold backdrop-blur-sm"><Icon className="h-5 w-5 text-secondary-200" />{label}</div>)}</div>
      </div>
    </section>

    <section className="relative flex min-h-[58vh] items-center justify-center px-5 py-12 sm:px-10 lg:min-h-screen lg:px-14">
      <div className="pointer-events-none absolute left-0 top-0 h-64 w-64 -translate-x-1/3 -translate-y-1/3 rounded-full bg-primary/5 blur-3xl" />
      <div className="relative w-full max-w-md">
        <div className="mb-8">
          <div className="mb-6 flex items-center gap-3 lg:hidden"><span className="grid h-11 w-11 place-items-center rounded-xl bg-primary text-white"><Lightbulb className="h-5 w-5" /></span><b>{site.name}</b></div>
          <p className="text-sm font-bold text-primary">مرحبًا بعودتك</p>
          <h2 className="mt-2 text-3xl font-black text-slate-900">تسجيل الدخول</h2>
          <p className="mt-3 text-sm leading-6 text-muted">أدخل بيانات حسابك للوصول إلى مساحة العمل ومتابعة رحلتك.</p>
        </div>

        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-2xl shadow-slate-200/60 sm:p-8">
          {preview ? <PreviewLoginForm /> : <LoginForm />}
        </div>

        {!preview ? <p className="mt-6 text-center text-xs text-muted">ليس لديك حساب؟ <Link href="/register" className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">إنشاء حساب جديد <ArrowUpLeft className="h-3 w-3" /></Link></p> : null}
        <p className="mt-5 text-center text-xs text-muted">© 2026 {site.name} — جميع الحقوق محفوظة</p>
      </div>
    </section>
  </main>;
}
