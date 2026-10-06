"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { AlertTriangle, CheckCircle2, FileText, LoaderCircle, Sparkles, UploadCloud } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import type { IdeaReadinessResult } from "./idea-readiness-schema";

const fieldClass = "mt-1.5 w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm outline-none focus:border-primary";

export function IdeaReadinessIntake({ accountKey, initialTitle, department, onComplete }: { accountKey: string; initialTitle: string; department: string; onComplete: (result: IdeaReadinessResult) => void }) {
  const [title, setTitle] = useState(initialTitle);
  const [ownerDepartment, setOwnerDepartment] = useState(department);
  const [problem, setProblem] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<IdeaReadinessResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function chooseFile(event: ChangeEvent<HTMLInputElement>) { setFile(event.target.files?.[0] ?? null); setResult(null); setError(""); }
  async function analyze(event: FormEvent) {
    event.preventDefault(); if (!file) return;
    setLoading(true); setError("");
    const body = new FormData(); body.set("title", title); body.set("department", ownerDepartment); body.set("problem", problem); body.set("file", file);
    try {
      const response = await fetch("/api/ux-preview/idea-readiness", { method: "POST", body });
      const payload = await response.json() as { result?: IdeaReadinessResult; error?: string };
      if (!response.ok || !payload.result) throw new Error(payload.error || "تعذر فحص الملف.");
      setResult(payload.result); setTitle(payload.result.title); setOwnerDepartment(payload.result.department); setProblem(payload.result.problem);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر فحص الملف."); }
    finally { setLoading(false); }
  }
  function confirm() { if (!result) return; const updated = { ...result, title, department: ownerDepartment, problem }; window.localStorage.setItem(`innovation-platform.idea-readiness.${accountKey}`, JSON.stringify(updated)); onComplete(updated); }

  return <div className="mx-auto w-full max-w-6xl space-y-5 pb-10" dir="rtl">
    <section className="rounded-[2rem] bg-gradient-to-br from-primary-700 via-primary to-secondary-600 p-6 text-white shadow-xl shadow-primary/10 sm:p-8"><Badge className="bg-white/15 text-white ring-1 ring-white/20">الخطوة الأولى</Badge><h1 className="mt-3 text-2xl font-black sm:text-3xl">رفع ملف الفكرة أو المشروع</h1><p className="mt-2 max-w-3xl text-sm leading-7 text-white/85">أدخل المعلومات الأساسية وارفع الملف. سيساعدك الفحص الذكي في استكمال البيانات وتحديد النواقص قبل بدء رحلة الابتكار.</p></section>
    <div className="grid gap-5 lg:grid-cols-[1.4fr_.7fr]"><form onSubmit={analyze} className="space-y-4"><Card><CardHeader><CardTitle>البيانات الأساسية</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-2"><label className="text-xs font-semibold">عنوان الفكرة<Input required className="mt-1.5" value={title} onChange={(event) => setTitle(event.target.value)}/></label><label className="text-xs font-semibold">الإدارة المالكة<Input required className="mt-1.5" value={ownerDepartment} onChange={(event) => setOwnerDepartment(event.target.value)}/></label><label className="text-xs font-semibold md:col-span-2">وصف المشكلة<textarea className={fieldClass} rows={4} required value={problem} onChange={(event) => setProblem(event.target.value)} placeholder="ما المشكلة أو الفرصة التي تعالجها الفكرة؟"/></label><label className="md:col-span-2"><span className="text-xs font-semibold">ملف الفكرة أو المشروع</span><span className="mt-1.5 flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-primary/30 bg-primary-50/40 p-5 hover:border-primary"><UploadCloud className="h-6 w-6 text-primary"/><span className="flex-1"><b className="block text-sm">اختر ملفًا للفحص</b><small className="text-muted">PDF أو DOCX أو TXT · الحد الأقصى 8 MB · لا يتم حفظ الملف</small></span><input className="sr-only" type="file" required accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" onChange={chooseFile}/></span></label>{file ? <div className="flex items-center gap-2 rounded-lg bg-slate-50 p-3 text-xs md:col-span-2"><FileText className="h-4 w-4 text-primary"/><span className="flex-1 font-semibold">{file.name}</span><span className="text-muted">{(file.size / 1024 / 1024).toFixed(2)} MB</span></div> : null}</CardContent></Card>
      {error ? <div className="flex gap-2 rounded-xl border border-danger/20 bg-red-50 p-4 text-sm text-danger"><AlertTriangle className="h-5 w-5 shrink-0"/>{error}</div> : null}
      <Button type="submit" disabled={!file || loading}>{loading ? <><LoaderCircle className="h-4 w-4 animate-spin"/>جارٍ قراءة الملف وفحص الجاهزية…</> : <><Sparkles className="h-4 w-4"/>فحص الجاهزية بالذكاء الاصطناعي</>}</Button>
      {result ? <Card className="border-primary/30"><CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><CardTitle>البيانات المستخرجة — قابلة للتعديل</CardTitle><Badge variant={result.score >= 70 ? "success" : "warning"}>{result.level}</Badge></div></CardHeader><CardContent className="grid gap-4 md:grid-cols-2"><label className="text-xs font-semibold">العنوان<Input className="mt-1.5" value={title} onChange={(event) => setTitle(event.target.value)}/></label><label className="text-xs font-semibold">الإدارة<Input className="mt-1.5" value={ownerDepartment} onChange={(event) => setOwnerDepartment(event.target.value)}/></label><label className="text-xs font-semibold md:col-span-2">المشكلة<textarea className={fieldClass} rows={3} value={problem} onChange={(event) => setProblem(event.target.value)}/></label><ReadOnlyField label="المستفيدون" value={result.beneficiaries}/><ReadOnlyField label="الحل المقترح" value={result.proposedSolution}/><ReadOnlyField label="الارتباط الاستراتيجي" value={result.strategicAlignment} wide/><div className="md:col-span-2"><Button type="button" onClick={confirm}><CheckCircle2 className="h-4 w-4"/>اعتماد البيانات وبدء الرحلة</Button></div></CardContent></Card> : null}
    </form><aside className="space-y-4"><Card><CardHeader><CardTitle>جاهزية الملف</CardTitle></CardHeader><CardContent>{result ? <><div className="flex items-end justify-between"><b className="text-3xl text-primary">{result.score}%</b><Badge variant="neutral">تقدير تحضيري</Badge></div><Progress className="mt-3" value={result.score}/><p className="mt-3 text-xs leading-6 text-muted">{result.recommendation}</p></> : <p className="text-sm leading-7 text-muted">ستظهر هنا درجة اكتمال العرض، نقاط القوة، والنواقص بعد فحص الملف.</p>}</CardContent></Card>{result ? <><ListCard title="نقاط القوة" items={result.strengths} tone="success"/><ListCard title="النواقص المطلوب استكمالها" items={[...result.gaps, ...result.missingFields]} tone="warning"/></> : null}<div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-6 text-amber-900">الفحص الذكي يساعد على التحضير فقط. لا يمثل قبولًا للفكرة أو تقييمًا رسميًا، والقرار النهائي للمراجعين المخولين.</div></aside></div>
  </div>;
}

function ReadOnlyField({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) { return <div className={wide ? "md:col-span-2" : ""}><p className="text-xs font-semibold">{label}</p><p className="mt-1.5 rounded-lg bg-slate-50 p-3 text-sm leading-6">{value}</p></div>; }
function ListCard({ title, items, tone }: { title: string; items: string[]; tone: "success" | "warning" }) { return <Card><CardHeader><CardTitle className="text-sm">{title}</CardTitle></CardHeader><CardContent className="space-y-2">{items.length ? items.map((item) => <div key={item} className="flex gap-2 text-xs leading-5"><span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${tone === "success" ? "bg-success" : "bg-warning"}`}/>{item}</div>) : <p className="text-xs text-muted">لا توجد عناصر مسجلة.</p>}</CardContent></Card>; }
