"use client";

import { useEffect, useState } from "react";
import { Eye, Plus, Trash2, Users } from "lucide-react";

import { buildPreviewHref } from "@/lib/ux-preview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { createPreviewInnovator, PREVIEW_INNOVATOR_STORAGE_KEY, readPreviewInnovators, type PreviewInnovatorAccount } from "./innovator-accounts";

export function InnovatorAccountManager() {
  const [accounts, setAccounts] = useState<PreviewInnovatorAccount[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setAccounts(readPreviewInnovators(window.localStorage.getItem(PREVIEW_INNOVATOR_STORAGE_KEY)));
    setReady(true);
  }, []);

  function save(next: PreviewInnovatorAccount[]) {
    setAccounts(next);
    window.localStorage.setItem(PREVIEW_INNOVATOR_STORAGE_KEY, JSON.stringify(next));
  }

  function generate() {
    save([...accounts, createPreviewInnovator(accounts.length)]);
  }

  function openExperience(account: PreviewInnovatorAccount) {
    window.location.assign(buildPreviewHref("/journey", "innovator", account.id));
  }

  return <div className="flex flex-col gap-5">
    <PageHeader title="المستخدمون والصلاحيات" description="إدارة شخصيات المعاينة وإنشاء حسابات مبتكرين لمراجعة تجربة المبتكر فقط." action={<Button onClick={generate}><Plus className="h-4 w-4"/>إنشاء حساب مبتكر</Button>} />
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      هذه الحسابات محفوظة في هذا المتصفح فقط. لا يُنشأ مستخدم حقيقي، ولا تُحفظ بيانات في قاعدة البيانات.
    </div>
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-primary"/>حسابات المبتكرين</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {!ready ? <p className="text-sm text-muted">جارٍ تحميل حسابات المعاينة…</p> : null}
        {ready && accounts.length === 0 ? <div className="rounded-xl border border-dashed p-8 text-center"><p className="font-semibold">لا توجد حسابات مبتكرين بعد</p><p className="mt-1 text-sm text-muted">أنشئ حسابًا ثم افتح تجربة المبتكر الخاصة به.</p><Button className="mt-4" onClick={generate}><Plus className="h-4 w-4"/>إنشاء أول حساب</Button></div> : null}
        {accounts.map((account) => <div key={account.id} className="grid gap-3 rounded-xl border p-4 md:grid-cols-[1.2fr_1.5fr_auto] md:items-center">
          <div><p className="font-semibold">{account.name}</p><p className="text-xs text-muted">{account.email} · {account.department}</p></div>
          <div><p className="text-sm font-medium">{account.ideaTitle}</p><div className="mt-1 flex flex-wrap gap-2"><Badge variant="primary">{account.stage}</Badge><span className="text-xs text-muted">التقدم {account.progress}%</span></div></div>
          <div className="flex gap-2"><Button size="sm" onClick={() => openExperience(account)}><Eye className="h-4 w-4"/>عرض التجربة</Button><Button size="sm" variant="outline" aria-label={`حذف ${account.name}`} onClick={() => save(accounts.filter((item) => item.id !== account.id))}><Trash2 className="h-4 w-4"/></Button></div>
        </div>)}
      </CardContent>
    </Card>
  </div>;
}
