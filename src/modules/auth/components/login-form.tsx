"use client";

import { useFormState, useFormStatus } from "react-dom";
import { useState } from "react";
import { Mail, Lock, Eye, EyeOff, AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginAction, type LoginState } from "@/modules/auth/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="mt-2 w-full" disabled={pending}>
      {pending ? "جارٍ تسجيل الدخول…" : "تسجيل الدخول"}
    </Button>
  );
}

export function LoginForm() {
  const [state, formAction] = useFormState<LoginState, FormData>(loginAction, {});
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {state.error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-xl bg-danger-bg px-3.5 py-2.5 text-sm text-danger"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          {state.error}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="email">البريد الإلكتروني</Label>
        <div className="relative">
          <Mail className="pointer-events-none absolute end-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="name@innovation.gov.sa"
            className="pe-10"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="password">كلمة المرور</Label>
        <div className="relative">
          <Lock className="pointer-events-none absolute end-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            placeholder="••••••••"
            className="px-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
            className="absolute start-3.5 top-1/2 -translate-y-1/2 text-muted hover:text-slate-600"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <SubmitButton />
    </form>
  );
}
