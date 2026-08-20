"use client";
import { useState } from "react";
import { useFormState } from "react-dom";
import { CheckCircle2, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { submitPublicIntakeAction, type PublicIntakeActionState } from "../intake-actions";

type PublicField = { key: string; label: string; type?: string; required?: boolean; enabled?: boolean };
export interface PublicIntakeView { token: string; name: string; purpose: string; type: string; participantDescription: string; instructions: string; relatedServiceName: string | null; fields: PublicField[] }

// 5.23.3.5 — العرض العام الآمن (بند 5/18): عنوان/غرض/حقول/إرسال فقط. لا لوحة
// تحكم، لا بيانات داخلية، لا وصول إلى ردود سابقة — التوكن للإرسال فقط.
export function PublicIntakeForm({ intake }: { intake: PublicIntakeView }) {
  const [state, action] = useFormState(submitPublicIntakeAction, {} as PublicIntakeActionState);
  const [consent, setConsent] = useState(false);
  const requiresParticipationType = intake.type === "كلاهما";
  const fieldByKey = (key: string) => intake.fields.find((field) => field.key === key);
  const isEnabled = (key: string, defaultEnabled = true) => fieldByKey(key)?.enabled ?? defaultEnabled;
  const isRequired = (key: string) => Boolean(fieldByKey(key)?.required);
  const requiresConsent = isEnabled("consent", false) && isRequired("consent");
  const customQuestion = fieldByKey("customQuestion1");
  if (state.success) {
    return (
      <main dir="rtl" className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900">
        <div className="mx-auto max-w-lg">
          <Card className="border-success/30">
            <CardContent className="p-8 text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-success" />
              <h1 className="mt-4 text-xl font-bold">تم استلام إرسالك</h1>
              <p className="mt-2 text-sm text-muted">{state.success}</p>
              {state.referenceNumber ? <p className="mt-4 rounded-lg bg-primary-50 p-3 text-sm font-bold text-primary">الرقم المرجعي: {state.referenceNumber}</p> : null}
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }
  return (
    <main dir="rtl" className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900">
      <div className="mx-auto max-w-2xl space-y-5">
        <div>
          <Badge variant="primary">{intake.type || "استقبال مقترحات وتغذية راجعة"}</Badge>
          <h1 className="mt-3 text-2xl font-bold">{intake.name}</h1>
          {intake.purpose ? <p className="mt-2 text-sm leading-7 text-muted">{intake.purpose}</p> : null}
          {intake.relatedServiceName ? <p className="mt-1 text-xs text-muted">يتعلق بالخدمة/الحل: {intake.relatedServiceName}</p> : null}
        </div>
        {intake.participantDescription ? <Card><CardContent className="p-4 text-sm leading-7">{intake.participantDescription}</CardContent></Card> : null}
        {intake.instructions ? <p className="rounded-lg bg-primary-50 p-3 text-xs leading-6">{intake.instructions}</p> : null}
        <Card>
          <CardHeader><CardTitle>الإرسال</CardTitle></CardHeader>
          <CardContent>
            <form action={action} className="space-y-4">
              <input type="hidden" name="token" value={intake.token} />
              <input type="hidden" name="consent" value={String(consent)} />
              <div className="grid gap-4 sm:grid-cols-2">
                {isEnabled("submitterName") ? <label className="text-xs font-semibold">الاسم {isRequired("submitterName") ? <span className="text-danger">*</span> : "(اختياري)"}<input name="submitterName" required={isRequired("submitterName")} className="mt-1 h-10 w-full rounded-lg border bg-transparent px-3 text-sm" /></label> : null}
                {isEnabled("submitterEmail") ? <label className="text-xs font-semibold">البريد الإلكتروني {isRequired("submitterEmail") ? <span className="text-danger">*</span> : "(اختياري)"}<input name="submitterEmail" type="email" required={isRequired("submitterEmail")} className="mt-1 h-10 w-full rounded-lg border bg-transparent px-3 text-sm" /></label> : null}
                {isEnabled("submitterOrg") ? <label className="text-xs font-semibold sm:col-span-2">الجهة/الإدارة {isRequired("submitterOrg") ? <span className="text-danger">*</span> : "(اختياري)"}<input name="submitterOrg" required={isRequired("submitterOrg")} className="mt-1 h-10 w-full rounded-lg border bg-transparent px-3 text-sm" /></label> : null}
                {requiresParticipationType ? (
                  <label className="text-xs font-semibold sm:col-span-2">نوع المشاركة <span className="text-danger">*</span>
                    <select name="participationType" required className="mt-1 h-10 w-full rounded-lg border bg-transparent px-3 text-sm"><option value="">اختر</option><option value="مقترحات">مقترح ابتكاري</option><option value="تغذية راجعة">تغذية راجعة</option></select>
                  </label>
                ) : null}
                <label className="text-xs font-semibold sm:col-span-2">العنوان <span className="text-danger">*</span><input required name="title" className="mt-1 h-10 w-full rounded-lg border bg-transparent px-3 text-sm" /></label>
                <label className="text-xs font-semibold sm:col-span-2">الوصف <span className="text-danger">*</span><textarea required name="description" className="mt-1 min-h-28 w-full rounded-lg border bg-transparent p-3 text-sm" /></label>
                {!intake.relatedServiceName ? <label className="text-xs font-semibold sm:col-span-2">الخدمة/الحل المرتبط (اختياري)<input name="relatedServiceName" className="mt-1 h-10 w-full rounded-lg border bg-transparent px-3 text-sm" /></label> : null}
                {customQuestion && isEnabled(customQuestion.key) ? (
                  <label className="text-xs font-semibold sm:col-span-2">{customQuestion.label} {isRequired(customQuestion.key) ? <span className="text-danger">*</span> : "(اختياري)"}
                    <input name={`custom:${customQuestion.key}`} required={isRequired(customQuestion.key)} className="mt-1 h-10 w-full rounded-lg border bg-transparent px-3 text-sm" />
                  </label>
                ) : null}
                {isEnabled("attachment") ? <label className="text-xs font-semibold sm:col-span-2">مرفق (اختياري — PDF أو DOCX أو XLSX)<input name="attachment" type="file" accept=".pdf,.docx,.xlsx" className="mt-1 block w-full text-xs" /></label> : null}
              </div>
              {requiresConsent ? (
                <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} required />أوافق على مشاركة هذه البيانات مع الجهة لغرض المتابعة.</label>
              ) : null}
              <Button className="w-full"><Send className="h-4 w-4" />إرسال</Button>
              {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
