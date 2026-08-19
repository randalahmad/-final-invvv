"use client";

import { useState } from "react";
import { Archive, Building2, CheckCircle2, Pencil, Plus, UserPlus, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { WorkspaceData } from "../workspace-status";
import type { ContributionView } from "@/modules/requirement-contributions/types";

type EvidenceRow = { relatedRecord?: string | null; reviewStatus: string };
type ContactPatch = Record<string, string>;

export function CooperationManager({ data, contributions, evidence, canEdit, onAddCooperation, onAddContact, onUpdateContact, onInviteContact }: {
  data: WorkspaceData;
  contributions: ContributionView[];
  evidence: EvidenceRow[];
  canEdit: boolean;
  onAddCooperation: () => void;
  onAddContact: (partnerName: string) => void;
  onUpdateContact: (index: number, patch: ContactPatch) => void;
  onInviteContact: (contactIndex: number, partnerName: string) => void;
}) {
  const cooperations = Array.isArray(data.cooperations) ? data.cooperations : [];
  const contacts = Array.isArray(data.partnerContacts) ? data.partnerContacts : [];
  const agreements = Array.isArray(data.agreements) ? data.agreements : [];
  const [selected, setSelected] = useState(0);
  const row = cooperations[selected] ?? cooperations[0];
  const partnerName = String(row?.partnerName || "");
  const partnerContacts = contacts.map((contact, index) => ({ contact, index })).filter(({ contact }) => String(contact.cooperationName || "") === partnerName);
  const agreement = agreements.find(item => String(item.cooperationName || "") === partnerName);
  const partnerContributors = contributions.filter(item => item.requesterNote?.includes(partnerName));
  function makePrimary(index: number) {
    partnerContacts.forEach(item => onUpdateContact(item.index, { isPrimary: item.index === index ? "نعم" : "لا" }));
  }

  return <div className="space-y-5">
    <Card>
      <CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><div><CardTitle>علاقات التعاون المؤسسي</CardTitle><p className="mt-1 text-xs text-muted">أنشئ الجهات والعلاقات هنا؛ حفظ جهة اتصال لا يمنحها دخولًا للمنصة.</p></div><div className="flex items-center gap-2"><Badge variant="primary">{cooperations.length} علاقة</Badge>{canEdit ? <Button size="sm" onClick={onAddCooperation}><Plus className="h-4 w-4"/>إضافة جهة / علاقة تعاون</Button> : null}</div></div></CardHeader>
      <CardContent className="grid gap-3 lg:grid-cols-2">{cooperations.map((item, index) => {
        const name = String(item.partnerName || `جهة جديدة ${index + 1}`);
        const itemAgreement = agreements.find(value => value.cooperationName === item.partnerName);
        const itemPrimary = contacts.find(value => value.cooperationName === item.partnerName && value.isPrimary === "نعم" && value.status !== "مؤرشف");
        const outstanding = contributions.filter(value => value.requesterNote?.includes(name) && !["COMPLETED", "CANCELLED"].includes(value.status)).length;
        return <button type="button" key={`${name}-${index}`} onClick={() => setSelected(index)} className={`rounded-xl border p-4 text-start transition ${selected === index ? "border-primary bg-primary-50/50" : "hover:border-primary/40"}`}><div className="flex items-start justify-between gap-3"><div><p className="font-bold">{name}</p><p className="mt-1 text-xs text-muted">{String(item.partnerType || "نوع غير محدد")} · {String(item.cooperationField || "مجال غير محدد")}</p></div><Badge variant="neutral">{String(item.status || "قيد الاستكمال")}</Badge></div><div className="mt-3 grid gap-1 text-xs sm:grid-cols-2"><p><b>المسؤول:</b> {String(item.internalOwner || "—")}</p><p><b>الاتصال الرئيسي:</b> {String(itemPrimary?.name || "—")}</p><p><b>الاتفاقية:</b> {String(itemAgreement?.status || "غير مكتملة")}</p><p><b>تاريخ النهاية:</b> {String(item.endDate || "—")}</p><p><b>إجراءات معلقة:</b> {outstanding}</p><p><b>التالي:</b> {!itemPrimary ? "تحديد اتصال رئيسي" : !itemAgreement ? "استكمال الاتفاقية" : outstanding ? "متابعة المساهمات" : "المراجعة الداخلية"}</p></div></button>;
      })}</CardContent>
    </Card>

    {row ? <Card><CardHeader><div className="flex items-center justify-between"><div><CardTitle>سجل التعاون — {partnerName || "جهة جديدة"}</CardTitle><p className="mt-1 text-xs text-muted">الاتصالات محفوظة في السجل، والمساهمون هم فقط من تمت دعوتهم صراحة.</p></div><Building2 className="h-5 w-5 text-primary"/></div></CardHeader><CardContent className="space-y-5">
      <div className="grid gap-3 md:grid-cols-2"><section className="rounded-xl border p-4"><h3 className="font-bold">الجهة</h3><p className="mt-2 text-xs"><b>النوع:</b> {String(row.partnerType || "—")}</p><p className="mt-1 text-xs"><b>النطاق:</b> {String(row.locationType || "—")} · {String(row.country || "—")}</p><p className="mt-1 text-xs text-muted">{String(row.description || "لا يوجد وصف بعد")}</p></section><section className="rounded-xl border p-4"><h3 className="font-bold">علاقة التعاون</h3><p className="mt-2 text-xs"><b>المجال:</b> {String(row.cooperationField || "—")}</p><p className="mt-1 text-xs"><b>الهدف:</b> {String(row.objective || "—")}</p><p className="mt-1 text-xs"><b>المدة:</b> {String(row.startDate || "—")} — {String(row.endDate || "—")}</p></section></div>
      <section><div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-bold">جهات الاتصال والمسؤولون</h3><p className="text-xs text-muted">لا يحصل الاتصال على وصول إلا بعد اختيار «دعوة للمساهمة».</p></div>{canEdit ? <Button size="sm" variant="outline" onClick={() => onAddContact(partnerName)}><Plus className="h-4 w-4"/>إضافة جهة اتصال</Button> : null}</div><div className="mt-3 grid gap-3 md:grid-cols-2">{partnerContacts.map(({ contact, index }) => { const archived = String(contact.status) === "مؤرشف"; const invited = partnerContributors.some(value => value.contributorEmail === contact.email && value.status !== "CANCELLED"); return <div key={`${String(contact.email)}-${index}`} className={`rounded-xl border p-4 ${archived ? "opacity-60" : ""}`}><div className="flex items-start justify-between"><div><p className="font-semibold">{String(contact.name || "جهة اتصال جديدة")}</p><p className="text-xs text-muted">{String(contact.title || "—")} · {String(contact.departmentName || "—")}</p></div>{String(contact.isPrimary) === "نعم" ? <Badge variant="success"><CheckCircle2 className="h-3 w-3"/>رئيسية</Badge> : null}</div><p className="mt-2 text-xs">{String(contact.email || "—")} {contact.phone ? `· ${String(contact.phone)}` : ""}</p><p className="mt-1 text-xs"><b>الدور:</b> {String(contact.role || "—")}</p><div className="mt-3 flex flex-wrap gap-2">{canEdit && !archived ? <><Button size="sm" variant="outline" onClick={() => document.getElementById("workspace-section-partnerContacts")?.scrollIntoView({ behavior: "smooth" })}><Pencil className="h-3.5 w-3.5"/>تعديل</Button>{String(contact.isPrimary) !== "نعم" ? <Button size="sm" variant="outline" onClick={() => makePrimary(index)}>تحديد كرئيسية</Button> : null}<Button size="sm" onClick={() => onInviteContact(index, partnerName)} disabled={invited}><UserPlus className="h-3.5 w-3.5"/>{invited ? "مساهم بالفعل" : "دعوة للمساهمة"}</Button><Button size="sm" variant="ghost" onClick={() => onUpdateContact(index, { status: "مؤرشف", isPrimary: "لا" })}><Archive className="h-3.5 w-3.5"/>أرشفة</Button></> : null}</div></div>; })}</div></section>
      <div className="grid gap-3 md:grid-cols-2"><section className="rounded-xl border p-4"><h3 className="font-bold">الاتفاقية والإثبات</h3><p className="mt-2 text-xs"><b>الاتفاقية:</b> {String(agreement?.title || "غير مكتملة")}</p><p className="mt-1 text-xs"><b>الحالة:</b> {String(agreement?.status || "—")}</p><p className="mt-1 text-xs"><b>الإثبات:</b> {evidence.some(item => item.relatedRecord === partnerName) ? "مرفوع — الرفع لا يعني الاعتماد" : "لم يرفع"}</p></section><section className="rounded-xl border p-4"><h3 className="flex items-center gap-2 font-bold"><Users className="h-4 w-4"/>المساهمون</h3>{partnerContributors.length ? partnerContributors.map(item => <p key={item.id} className="mt-2 text-xs">{item.contributorName} — {item.status}</p>) : <p className="mt-2 text-xs text-muted">لا يوجد مساهمون مدعوون لهذه العلاقة.</p>}</section></div>
      <div className="grid gap-3 md:grid-cols-2"><section className="rounded-xl border p-4"><h3 className="font-bold">المهام والمتابعة</h3><p className="mt-2 text-xs">{partnerContributors.filter(item => !["COMPLETED", "CANCELLED"].includes(item.status)).length} إجراء مساهمة قائم.</p></section><section className="rounded-xl border p-4"><h3 className="font-bold">سجل النشاط</h3><p className="mt-2 text-xs text-muted">تظهر تغييرات السجل والدعوات والمساهمات في سجل التدقيق التشغيلي.</p></section></div>
    </CardContent></Card> : null}
  </div>;
}
