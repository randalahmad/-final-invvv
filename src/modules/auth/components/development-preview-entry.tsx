"use client";

import { useEffect, useRef } from "react";
import { LoaderCircle } from "lucide-react";

import { enterDevelopmentPreviewAction } from "@/modules/auth/actions";

export function DevelopmentPreviewEntry() {
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    formRef.current?.requestSubmit();
  }, []);

  return <main className="flex min-h-screen items-center justify-center bg-bg px-4">
    <form ref={formRef} action={enterDevelopmentPreviewAction} className="card-surface flex w-full max-w-sm flex-col items-center rounded-3xl p-8 text-center">
      <LoaderCircle className="h-8 w-8 animate-spin text-primary" />
      <h1 className="mt-4 text-lg font-extrabold text-foreground">جاري فتح بيئة المعاينة</h1>
      <p className="mt-2 text-sm text-muted">سيتم الدخول محليًا، وبعدها يمكنك تبديل الواجهة مباشرة من أعلى الصفحة.</p>
      <button type="submit" className="mt-5 text-xs font-semibold text-primary hover:underline">المتابعة يدويًا</button>
    </form>
  </main>;
}
