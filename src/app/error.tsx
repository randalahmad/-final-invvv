"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const forbidden = error.message?.startsWith("FORBIDDEN");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg px-4 text-center dark:bg-bg-dark">
      <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100">
        {forbidden ? "لا تملك صلاحية الوصول" : "حدث خطأ غير متوقع"}
      </h1>
      <p className="max-w-sm text-sm text-muted">
        {forbidden
          ? "ليست لديك الصلاحية اللازمة لعرض هذا المحتوى. تواصل مع مدير النظام."
          : "نعتذر عن ذلك. يمكنك إعادة المحاولة أو العودة لاحقًا."}
      </p>
      {!forbidden && <Button onClick={reset}>إعادة المحاولة</Button>}
    </div>
  );
}
