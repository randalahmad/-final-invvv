"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Eye, EyeOff, Lock, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PreviewLoginForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/ux-preview/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
    });
    const result = await response.json().catch(() => ({})) as { destination?: string; message?: string };
    if (!response.ok || !result.destination) {
      setError(result.message ?? "تعذر تسجيل الدخول. حاول مرة أخرى.");
      setPending(false);
      return;
    }
    router.replace(result.destination);
    router.refresh();
  }

  return <form onSubmit={submit} className="flex flex-col gap-5">
    {error && <div role="alert" className="flex items-center gap-2 rounded-xl bg-danger-bg px-3.5 py-2.5 text-sm text-danger"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}
    <div className="flex flex-col gap-2"><Label htmlFor="email">البريد الإلكتروني</Label><div className="relative"><Mail className="pointer-events-none absolute end-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" /><Input id="email" name="email" type="email" autoComplete="username" required placeholder="name@innovation.local" className="pe-10" /></div></div>
    <div className="flex flex-col gap-2"><Label htmlFor="password">كلمة المرور</Label><div className="relative"><Lock className="pointer-events-none absolute end-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" /><Input id="password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required placeholder="••••••••" className="px-10" /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"} className="absolute start-3.5 top-1/2 -translate-y-1/2 text-muted hover:text-slate-600">{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></div>
    <Button type="submit" size="lg" className="mt-2 w-full" disabled={pending}>{pending ? "جارٍ تسجيل الدخول…" : "تسجيل الدخول"}</Button>
  </form>;
}
