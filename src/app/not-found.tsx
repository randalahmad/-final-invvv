import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg px-4 text-center dark:bg-bg-dark">
      <span className="text-5xl font-extrabold text-primary">٤٠٤</span>
      <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100">الصفحة غير موجودة</h1>
      <p className="max-w-sm text-sm text-muted">
        تعذّر العثور على الصفحة المطلوبة. قد يكون الرابط قديمًا أو تم نقل المحتوى.
      </p>
      <Button asChild>
        <Link href="/dashboard">العودة إلى لوحة المؤشرات</Link>
      </Button>
    </div>
  );
}
