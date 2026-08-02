"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function SolutionsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const forbidden = error.message?.startsWith("FORBIDDEN");

  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center dark:border-border-dark">
      <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
        {forbidden ? "لا تملك صلاحية الوصول لسجل الحلول" : "حدث خطأ غير متوقع"}
      </h2>
      <p className="max-w-sm text-sm text-muted">
        {forbidden ? "ليست لديك الصلاحية اللازمة لعرض هذا السجل. تواصل مع مدير النظام." : "يمكنك إعادة المحاولة."}
      </p>
      {!forbidden && (
        <Button onClick={reset} size="sm">
          إعادة المحاولة
        </Button>
      )}
    </div>
  );
}
