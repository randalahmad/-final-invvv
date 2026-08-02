"use client";

import { useFormState, useFormStatus } from "react-dom";
import { useState } from "react";
import { AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { registerAction, type RegisterState } from "@/modules/registration/actions";

const ROLE_OPTIONS = [
  { value: "INTERNAL_EDITOR", label: "محرر داخلي — إدارة سجلات نطاقه" },
  { value: "EXTERNAL_PARTNER", label: "شريك خارجي — وصول مقيّد للاتفاقيات المشتركة" },
  { value: "VIEWER", label: "مطّلع — قراءة فقط للمحتوى المنشور" },
] as const;

const ORG_TYPE_OPTIONS = [
  { value: "UNIVERSITY", label: "جامعة" },
  { value: "COMPANY", label: "شركة" },
  { value: "GOVERNMENT", label: "جهة حكومية" },
  { value: "PARTNER", label: "جهة شريكة" },
  { value: "OTHER", label: "أخرى" },
] as const;

const fieldClass =
  "w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-border-dark dark:bg-surface-dark";

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return <p className="text-[11.5px] text-danger">{errors[0]}</p>;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="mt-2 w-full" disabled={pending}>
      {pending ? "جارٍ إرسال الطلب…" : "إرسال طلب التسجيل"}
    </Button>
  );
}

export function RegisterForm() {
  const [state, formAction] = useFormState<RegisterState, FormData>(registerAction, {});
  const [role, setRole] = useState<string>("");
  const fe = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.error && (
        <div role="alert" className="flex items-center gap-2 rounded-xl bg-danger-bg px-3.5 py-2.5 text-sm text-danger">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {state.error}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="name">الاسم الكامل</Label>
        <Input id="name" name="name" required autoComplete="name" placeholder="الاسم الثلاثي" />
        <FieldError errors={fe.name} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="email">البريد الإلكتروني</Label>
        <Input id="email" name="email" type="email" required autoComplete="email" placeholder="name@innovation.gov.sa" />
        <FieldError errors={fe.email} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">كلمة المرور</Label>
          <Input id="password" name="password" type="password" required autoComplete="new-password" placeholder="8 أحرف على الأقل" />
          <FieldError errors={fe.password} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="confirmPassword">تأكيد كلمة المرور</Label>
          <Input id="confirmPassword" name="confirmPassword" type="password" required autoComplete="new-password" placeholder="••••••••" />
          <FieldError errors={fe.confirmPassword} />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="requestedRole">نوع المستخدم المطلوب</Label>
        <select
          id="requestedRole"
          name="requestedRole"
          required
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className={fieldClass}
        >
          <option value="" disabled>
            اختر نوع المستخدم…
          </option>
          {ROLE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <FieldError errors={fe.requestedRole} />
      </div>

      {role === "EXTERNAL_PARTNER" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="requestedOrgType">نوع الجهة</Label>
            <select id="requestedOrgType" name="requestedOrgType" className={fieldClass} defaultValue="">
              <option value="">غير محدّد</option>
              {ORG_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="requestedOrganizationName">اسم الجهة</Label>
            <Input id="requestedOrganizationName" name="requestedOrganizationName" placeholder="اسم الجهة الخارجية" />
            <FieldError errors={fe.requestedOrganizationName} />
          </div>
        </div>
      )}

      {role === "INTERNAL_EDITOR" && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="requestedDepartmentId">الإدارة المطلوبة</Label>
          <Input id="requestedDepartmentId" name="requestedDepartmentId" placeholder="اسم أو معرّف الإدارة المطلوبة" />
          <p className="text-[11px] text-muted">سيؤكّد مدير النظام الإدارة والنطاق عند الاعتماد.</p>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="registrationNote">ملاحظة (اختياري)</Label>
        <textarea id="registrationNote" name="registrationNote" rows={2} className={fieldClass} placeholder="أي معلومات إضافية تساعد في المراجعة" />
        <FieldError errors={fe.registrationNote} />
      </div>

      <label className="flex items-start gap-2 text-[12.5px] text-slate-600 dark:text-slate-300">
        <input type="checkbox" name="acceptTerms" value="true" required className="mt-0.5 h-4 w-4 accent-primary" />
        <span>أوافق على شروط الاستخدام وسياسة الخصوصية الخاصة بالمنصة.</span>
      </label>
      <FieldError errors={fe.acceptTerms} />

      <SubmitButton />
    </form>
  );
}
