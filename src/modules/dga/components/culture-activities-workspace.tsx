"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, Link2, Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { WorkspaceData } from "../workspace-status";
import { CULTURE_ACTIVITY_TYPES, isQualifyingCultureActivity } from "../workspace-config";
import type { ContributionView } from "@/modules/requirement-contributions/types";

type Row = Record<string, unknown>;
type EvidenceRow = { id: string; classification: string | null; reviewStatus: string; relatedRecord?: string | null };
type UserOption = { id: string; name: string; email: string };

const tabs = ["نظرة عامة", "الخطة والجدول الزمني", "الفريق والمسؤوليات", "المهام", "اللقاءات والاجتماعات", "المشاركون / المستفيدون", "الملفات والمواد المعرفية", "المخرجات", "تقرير الإنجاز", "الأدلة والإغلاق", "سجل النشاط"] as const;
type Tab = (typeof tabs)[number];
const TASK_STATUS_LABELS: Record<string, string> = { NOT_STARTED: "لم تبدأ", IN_PROGRESS: "قيد التنفيذ", WAITING: "بانتظار طرف آخر", REVIEW: "بانتظار مراجعة", COMPLETED: "مكتملة", OVERDUE: "متأخرة", CANCELLED: "ملغاة" };
const TASK_PRESETS = ["تجهيز المحتوى", "تصميم الإعلان", "التنسيق مع المدرب", "دعوة المشاركين", "تجهيز القاعة", "تسجيل الحضور", "رفع المواد", "إعداد تقرير الإنجاز"] as const;
const REQUIRED_MIN = 3;

const newId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const arr = (value: unknown) => (Array.isArray(value) ? (value as Row[]) : []);
const EditContext = createContext(true);

function Text({ label, value, onChange, area = false, type = "text", required = false }: { label: string; value: unknown; onChange: (value: string) => void; area?: boolean; type?: string; required?: boolean }) {
  const editable = useContext(EditContext);
  return (
    <label className="text-xs font-semibold">
      {label}
      {required ? <span className="text-danger"> *</span> : null}
      {area ? (
        <textarea disabled={!editable} value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} className="mt-1 min-h-20 w-full rounded-lg border bg-transparent p-3 text-xs disabled:cursor-not-allowed disabled:opacity-70" />
      ) : (
        <input disabled={!editable} type={type} value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} className="mt-1 h-9 w-full rounded-lg border bg-transparent px-3 text-xs disabled:cursor-not-allowed disabled:opacity-70" />
      )}
    </label>
  );
}
function Select({ label, value, values, labels, onChange, required = false }: { label: string; value: unknown; values: readonly string[]; labels?: Record<string, string>; onChange: (value: string) => void; required?: boolean }) {
  const editable = useContext(EditContext);
  return (
    <label className="text-xs font-semibold">
      {label}
      {required ? <span className="text-danger"> *</span> : null}
      <select disabled={!editable} value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} className="mt-1 h-9 w-full rounded-lg border bg-transparent px-3 text-xs disabled:cursor-not-allowed disabled:opacity-70">
        <option value="">اختر</option>
        {values.map((item) => (
          <option key={item} value={item}>{labels?.[item] ?? item}</option>
        ))}
      </select>
    </label>
  );
}
function Repeatable({ title, hint, rows, canEdit, fields, add, update }: { title: string; hint?: string; rows: Row[]; canEdit: boolean; fields: [string, string][]; add: () => void; update: (index: number, patch: Row) => void }) {
  return (
    <Card>
      <CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><div><CardTitle>{title}</CardTitle>{hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}</div>{canEdit ? <Button size="sm" onClick={add}><Plus className="h-4 w-4" />إضافة سجل</Button> : null}</div></CardHeader>
      <CardContent className="space-y-3">
        {rows.map((row, index) => (
          <div key={String(row.id ?? index)} className="grid gap-3 rounded-xl border p-3 sm:grid-cols-2">
            {fields.map(([key, label]) => <Text key={key} label={label} value={row[key]} onChange={(v) => update(index, { [key]: v })} />)}
          </div>
        ))}
        {!rows.length ? <p className="rounded-lg border border-dashed p-6 text-center text-xs text-muted">لا توجد سجلات بعد.</p> : null}
      </CardContent>
    </Card>
  );
}

export function CultureActivitiesWorkspace({
  data,
  canEdit,
  onChange,
  personaKey = "admin",
  users = [],
  evidence = [],
  annualPlanData = {},
  contributions = [],
  initialActivityId,
}: {
  data: WorkspaceData;
  canEdit: boolean;
  onChange: (data: WorkspaceData) => void;
  personaKey?: string;
  users?: UserOption[];
  evidence?: EvidenceRow[];
  annualPlanData?: WorkspaceData;
  contributions?: ContributionView[];
  initialActivityId?: string;
}) {
  const activities = arr(data.cultureActivities);
  const initialIndex = activities.findIndex((row) => row.id === initialActivityId);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(initialIndex >= 0 ? initialIndex : null);
  const [tab, setTab] = useState<Tab>("نظرة عامة");
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash.startsWith("#task-")) setTab("المهام");
  }, [selectedIndex]);
  const restricted = personaKey === "viewer" || personaKey === "partner";
  const availableTabs = personaKey === "viewer" ? tabs.filter((item) => !["الفريق والمسؤوليات", "المهام", "المشاركون / المستفيدون", "الملفات والمواد المعرفية", "سجل النشاط"].includes(item)) : personaKey === "partner" ? tabs.filter((item) => !["الفريق والمسؤوليات", "المهام", "سجل النشاط"].includes(item)) : tabs;

  const qualifying = activities.filter(isQualifyingCultureActivity);
  const completed = activities.filter((row) => row.status === "مكتملة").length;
  const upcoming = activities.filter((row) => row.status === "مخطط لها" || row.status === "قيد التنفيذ").length;
  const openTasks = activities.flatMap((row) => arr(row.tasks)).filter((task) => !["COMPLETED", "CANCELLED"].includes(String(task.status))).length;
  const totalParticipants = activities.reduce((sum, row) => sum + arr(row.participants).length, 0);
  const missingReports = qualifying.filter((row) => !evidence.some((item) => item.classification === "CULTURE_ACTIVITY_COMPLETION_REPORTS" && item.relatedRecord === row.name)).length;
  const pendingContributions = contributions.filter((item) => !["COMPLETED", "CANCELLED"].includes(item.status)).length;
  const readinessGaps = [
    qualifying.length < REQUIRED_MIN ? `يلزم توثيق ${REQUIRED_MIN - qualifying.length} نشاط إضافي مؤهَّل على الأقل (${qualifying.length} / ${REQUIRED_MIN} حاليًا)` : null,
    activities.some((row) => !isQualifyingCultureActivity(row)) ? "توجد أنشطة غير مكتملة التصنيف الثقافي، فلا تُحتسب ضمن الحد الأدنى" : null,
    missingReports > 0 ? `${missingReports} نشاط مؤهَّل بلا تقرير إنجاز/دليل رسمي مرتبط` : null,
    openTasks > 0 ? `${openTasks} مهمة تنظيمية مفتوحة` : null,
    pendingContributions > 0 ? `${pendingContributions} توكيل/مساهمة مسندة قيد الإنجاز` : null,
  ].filter((item): item is string => Boolean(item));
  const nextAction = readinessGaps[0] ?? "لا يوجد نقص ظاهر — تابع رفع واعتماد أدلة الأنشطة الثلاثة على الأقل.";

  const eligibleAnnualActivities = arr(annualPlanData.activities).filter((row) => !["CANCELLED", "ملغاة"].includes(String(row.status)) && !activities.some((activity) => activity.annualPlanActivityId === (row.activityId ?? row.id)));

  function replace(next: Row) { onChange({ ...data, cultureActivities: activities.map((row, index) => (index === selectedIndex ? next : row)) }); }
  function openActivity(index: number) {
    setSelectedIndex(index);
    setTab("نظرة عامة");
    const row = activities[index];
    if (row?.id && typeof window !== "undefined") window.history.pushState({}, "", `/governance/requirements/5-23-3-r3/activities/${row.id}${window.location.search}`);
  }
  function addActivity(linked?: Row) {
    const next: Row = {
      id: newId("culture-activity"), name: String(linked?.name ?? linked?.activity ?? "نشاط جديد لنشر ثقافة الابتكار"), cultureType: "", awarenessGoal: "", targetSegment: String(linked?.targetAudience ?? linked?.audience ?? ""), department: String(linked?.owningDepartment ?? ""), startDate: String(linked?.startDate ?? ""), endDate: String(linked?.endDate ?? ""), status: "مخطط لها", knowledgeTopic: "", presenter: "", outcomeDescription: "",
      annualPlanActivityId: String(linked?.activityId ?? linked?.id ?? ""), annualPlanActivityName: String(linked?.name ?? linked?.activity ?? ""),
      milestones: arr(linked?.milestones), team: arr(linked?.team), tasks: arr(linked?.tasks), meetings: arr(linked?.meetings), participants: arr(linked?.participants), files: arr(linked?.files), outputs: arr(linked?.outputs),
      log: [{ date: new Date().toISOString(), action: linked ? "ربط نشاط بالخطة السنوية دون إنشاء نشاط مكرر" : "إنشاء نشاط جديد لنشر ثقافة الابتكار" }],
    };
    onChange({ ...data, cultureActivities: [...activities, next] });
    setSelectedIndex(activities.length);
    setTab("نظرة عامة");
    setNotice(linked ? "أُنشئ سجل نشر ثقافة مرتبط ببيانات النشاط في الخطة السنوية، دون إنشاء نشاط مكرر. أكمل التصنيف الثقافي ثم احفظ." : "أضيف نشاط جديد عبر البنية التشغيلية المشتركة. أكمل التصنيف الثقافي ثم احفظ.");
  }
  function update(key: string, value: unknown) { if (selectedIndex === null) return; replace({ ...activities[selectedIndex], [key]: value, log: [{ date: new Date().toISOString(), action: "تحديث بيانات النشاط" }, ...arr(activities[selectedIndex]?.log)] }); }
  function addRecord(key: string, row: Row) { if (selectedIndex === null) return; update(key, [...arr(activities[selectedIndex]?.[key]), row]); }
  function patchRecord(key: string, index: number, patch: Row) { if (selectedIndex === null) return; update(key, arr(activities[selectedIndex]?.[key]).map((row, i) => (i === index ? { ...row, ...patch } : row))); }
  function closeActivity() {
    if (selectedIndex === null) return;
    const row = activities[selectedIndex];
    const gaps = [arr(row.tasks).some((t) => !["COMPLETED", "CANCELLED"].includes(String(t.status))), !arr(row.outputs).length, !arr(row.files).some((f) => f.markedAsEvidence === "نعم")];
    if (gaps.some(Boolean)) { setNotice("لا يمكن إغلاق النشاط: توجد مهام مفتوحة أو مخرجات/مواد مرشحة للإثبات ناقصة."); return; }
    replace({ ...row, status: "مكتملة", log: [{ date: new Date().toISOString(), action: "إغلاق النشاط بعد استكمال قائمة الإغلاق" }, ...arr(row.log)] });
  }

  const current = selectedIndex === null ? null : activities[selectedIndex];

  if (!current) {
    return (
      <div className="space-y-5">
        <Card className="border-primary/20">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle>أنشطة نشر ثقافة الابتكار</CardTitle>
                <p className="mt-1 text-xs text-muted">كل نشاط يُبنى على بنية النشاط التشغيلية المشتركة نفسها المستخدمة في الخطة السنوية (5.23.2.1) — لا يُنشأ نظام فعاليات مستقل.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={qualifying.length >= REQUIRED_MIN ? "success" : "warning"}>فعاليات نشر ثقافة الابتكار {qualifying.length} / {REQUIRED_MIN}</Badge>
                {canEdit ? (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => addActivity()}><Plus className="h-4 w-4" />إنشاء نشاط جديد</Button>
                    <Button size="sm" variant="outline" onClick={() => (eligibleAnnualActivities[0] ? addActivity(eligibleAnnualActivities[0]) : setNotice("لا يوجد نشاط مؤهل غير مرتبط في الخطة السنوية حاليًا."))}><Link2 className="h-4 w-4" />ربط نشاط من الخطة السنوية</Button>
                  </div>
                ) : null}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 text-center text-xs sm:grid-cols-5">
              {[[activities.length, "الأنشطة"], [completed, "مكتملة"], [upcoming, "قادمة/جارية"], [totalParticipants, "مشارك"], [openTasks, "مهمة مفتوحة"]].map(([value, label]) => (
                <div key={String(label)} className="rounded-lg border p-2"><b>{value}</b><p className="text-muted">{label}</p></div>
              ))}
            </div>
            <label className="relative mt-4 block">
              <Search className="absolute right-3 top-3 h-4 w-4 text-muted" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث بالاسم أو نوع النشاط" className="h-10 w-full rounded-lg border bg-transparent pr-10 pl-3 text-sm" />
            </label>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>الجاهزية</CardTitle><p className="mt-1 text-xs text-muted">توثيق الأنشطة لا يعني الاعتماد الرسمي — الجاهزية توضيح للفجوات الفعلية دون درجة مُخترعة.</p></CardHeader>
          <CardContent className="space-y-2">
            {readinessGaps.length ? readinessGaps.map((gap) => <p key={gap} className="flex items-center gap-2 text-xs leading-5"><AlertTriangle className="h-4 w-4 shrink-0 text-warning" />{gap}</p>) : <p className="flex items-center gap-2 text-sm text-success"><CheckCircle2 className="h-5 w-5" />لا يوجد نقص ظاهر حاليًا.</p>}
            <p className="mt-2 rounded-lg bg-primary-50 p-3 text-xs"><b>الإجراء التالي:</b> {nextAction}</p>
          </CardContent>
        </Card>
        <div className="grid gap-4 xl:grid-cols-2">
          {activities.filter((row) => `${row.name} ${row.cultureType}`.includes(query)).map((row) => {
            const index = activities.indexOf(row);
            const qualifies = isQualifyingCultureActivity(row);
            return (
              <Card key={String(row.id)}>
                <CardContent className="p-5">
                  <div className="flex flex-wrap justify-between gap-3">
                    <div>
                      <Badge variant={qualifies ? "primary" : "neutral"}>{String(row.cultureType || "بلا تصنيف")}</Badge>
                      <h3 className="mt-2 font-bold">{String(row.name)}</h3>
                      <p className="mt-1 text-xs text-muted">{String(row.department || "—")} · {String(row.startDate || "—")} — {String(row.endDate || "—")}</p>
                    </div>
                    <Badge variant={row.status === "مكتملة" ? "success" : row.status === "ملغاة" ? "danger" : "warning"}>{String(row.status)}</Badge>
                  </div>
                  {row.annualPlanActivityName ? <p className="mt-3 rounded-lg bg-primary-50 p-2 text-[11px]"><Link2 className="ml-1 inline h-3.5 w-3.5" />مرتبط بنشاط الخطة السنوية: {String(row.annualPlanActivityName)}</p> : null}
                  {!qualifies ? <p className="mt-3 flex items-center gap-1.5 text-[11px] text-warning"><AlertTriangle className="h-3.5 w-3.5" />لا يُحتسب ضمن الـ{REQUIRED_MIN} حتى يكتمل تصنيفه الثقافي وهدفه وفئته المستهدفة.</p> : null}
                  <div className="mt-4 flex items-center justify-between"><p className="text-xs text-muted">{arr(row.participants).length} مشارك · {arr(row.outputs).length} مخرج</p><Button size="sm" onClick={() => openActivity(index)}>فتح مساحة النشاط <ArrowLeft className="h-4 w-4" /></Button></div>
                </CardContent>
              </Card>
            );
          })}
          {!activities.length ? <Card className="xl:col-span-2"><CardContent className="p-10 text-center text-sm text-muted">لا توجد أنشطة بعد. أنشئ نشاطًا جديدًا أو اربط نشاطًا قائمًا من الخطة السنوية.</CardContent></Card> : null}
        </div>
        {notice ? <p className="rounded-lg bg-primary-50 p-3 text-sm">{notice}</p> : null}
      </div>
    );
  }

  return (
    <EditContext.Provider value={canEdit}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" onClick={() => setSelectedIndex(null)}><ArrowLeft className="h-4 w-4" />أنشطة نشر ثقافة الابتكار</Button>
          <Badge variant={isQualifyingCultureActivity(current) ? "success" : "warning"}>{isQualifyingCultureActivity(current) ? "مؤهَّل ضمن المتطلب" : "غير مؤهَّل بعد"}</Badge>
        </div>
        <Card className="border-primary/20">
          <CardContent className="p-5">
            <div className="flex flex-wrap justify-between gap-3">
              <div><Badge variant="primary">{String(current.cultureType || "بلا تصنيف")}</Badge><h2 className="mt-2 text-xl font-bold">{String(current.name)}</h2><p className="mt-1 text-xs text-muted">{String(current.department || "—")} · {String(current.startDate || "—")} — {String(current.endDate || "—")}</p></div>
              <Badge variant={current.status === "مكتملة" ? "success" : "warning"}>{String(current.status)}</Badge>
            </div>
          </CardContent>
        </Card>
        <div className="flex gap-2 overflow-x-auto pb-2">{availableTabs.map((item) => <Button key={item} size="sm" variant={tab === item ? "default" : "outline"} onClick={() => setTab(item)}>{item}</Button>)}</div>
        <div id="culture-activity-tabs">
          {tab === "نظرة عامة" ? <Overview activity={current} canEdit={canEdit} update={update} /> : null}
          {tab === "الخطة والجدول الزمني" ? <Repeatable title="المحطات والجدول الزمني" rows={arr(current.milestones)} canEdit={canEdit} fields={[["title", "العنوان"], ["date", "الموعد"], ["owner", "المسؤول"], ["status", "الحالة"]]} add={() => addRecord("milestones", { id: newId("milestone"), title: "محطة جديدة", date: "", owner: "", status: "لم تبدأ" })} update={(i, p) => patchRecord("milestones", i, p)} /> : null}
          {tab === "الفريق والمسؤوليات" && !restricted ? <Repeatable title="فريق النشاط" hint="فريق النشاط منفصل عن مساهمي توثيق المتطلب." rows={arr(current.team)} canEdit={canEdit} fields={[["name", "الاسم"], ["department", "الإدارة"], ["role", "الدور"], ["responsibilities", "المسؤوليات"]]} add={() => addRecord("team", { id: newId("team"), name: "", department: "", role: "", responsibilities: "" })} update={(i, p) => patchRecord("team", i, p)} /> : null}
          {tab === "المهام" && !restricted ? <TasksPanel rows={arr(current.tasks)} users={users} canEdit={canEdit} add={(row) => addRecord("tasks", row)} update={(i, p) => { patchRecord("tasks", i, p); if (p.status === "COMPLETED") update("log", [{ date: new Date().toISOString(), action: `إكمال مهمة: ${String(arr(current.tasks)[i]?.title ?? "")}` }, ...arr(current.log)]); }} /> : null}
          {tab === "اللقاءات والاجتماعات" ? <Meetings rows={arr(current.meetings)} canEdit={canEdit} add={(row) => addRecord("meetings", row)} createTask={(row) => addRecord("tasks", row)} update={(i, p) => patchRecord("meetings", i, p)} /> : null}
          {tab === "المشاركون / المستفيدون" && !restricted ? <Repeatable title="المشاركون والمستفيدون" hint="لا تُنشأ حسابات مستخدمين تلقائيًا للمشاركين." rows={arr(current.participants)} canEdit={canEdit} fields={[["name", "الاسم"], ["organization", "الجهة/الإدارة"], ["category", "الفئة"], ["attendance", "الحضور"]]} add={() => addRecord("participants", { id: newId("participant"), name: "", organization: "", category: "موظف", attendance: "مسجل" })} update={(i, p) => patchRecord("participants", i, p)} /> : null}
          {tab === "الملفات والمواد المعرفية" && !restricted ? <Files rows={arr(current.files)} canEdit={canEdit} add={(row) => addRecord("files", row)} update={(i, p) => patchRecord("files", i, p)} /> : null}
          {tab === "المخرجات" ? <Repeatable title="مخرجات النشاط" rows={arr(current.outputs)} canEdit={canEdit} fields={[["name", "اسم المخرج"], ["type", "النوع"], ["owner", "المسؤول"], ["status", "الحالة"]]} add={() => addRecord("outputs", { id: newId("output"), name: "", type: "", owner: "", status: "قيد التنفيذ" })} update={(i, p) => patchRecord("outputs", i, p)} /> : null}
          {tab === "تقرير الإنجاز" ? <ActivityReport activity={current} evidence={evidence} /> : null}
          {tab === "الأدلة والإغلاق" ? <Closure activity={current} evidence={evidence} canEdit={canEdit} onClose={closeActivity} /> : null}
          {tab === "سجل النشاط" && !restricted ? <Log rows={arr(current.log)} /> : null}
        </div>
        {notice ? <p className="rounded-lg bg-primary-50 p-3 text-sm">{notice}</p> : null}
      </div>
    </EditContext.Provider>
  );
}

function Overview({ activity, canEdit, update }: { activity: Row; canEdit: boolean; update: (key: string, value: unknown) => void }) {
  const qualifies = isQualifyingCultureActivity(activity);
  return (
    <div className="space-y-4">
      {!qualifies ? <p className="flex items-center gap-2 rounded-lg bg-warning-bg p-3 text-xs text-warning"><AlertTriangle className="h-4 w-4" />أكمل نوع النشاط والهدف التوعوي/التدريبي والفئة المستهدفة ليُحتسب هذا النشاط ضمن الحد الأدنى المطلوب.</p> : null}
      <Card>
        <CardHeader><CardTitle>بيانات النشاط الأساسية</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <Text label="اسم النشاط" value={activity.name} required onChange={(v) => canEdit && update("name", v)} />
          <Select label="نوع نشاط نشر الثقافة" value={activity.cultureType} values={CULTURE_ACTIVITY_TYPES} required onChange={(v) => canEdit && update("cultureType", v)} />
          <Text label="الإدارة المسؤولة" value={activity.department} onChange={(v) => canEdit && update("department", v)} />
          <Select label="الحالة" value={activity.status} values={["مخطط لها", "قيد التنفيذ", "مكتملة", "ملغاة"]} onChange={(v) => canEdit && update("status", v)} />
          <Text label="تاريخ البداية" type="date" value={activity.startDate} onChange={(v) => canEdit && update("startDate", v)} />
          <Text label="تاريخ النهاية" type="date" value={activity.endDate} onChange={(v) => canEdit && update("endDate", v)} />
          <Text label="الفئة المستهدفة" value={activity.targetSegment} required onChange={(v) => canEdit && update("targetSegment", v)} />
          <Text label="موضوع المعرفة (إن وجد)" value={activity.knowledgeTopic} onChange={(v) => canEdit && update("knowledgeTopic", v)} />
          <Text label="مقدم/مدرب (إن وجد)" value={activity.presenter} onChange={(v) => canEdit && update("presenter", v)} />
          <div className="md:col-span-2"><Text label="الهدف التوعوي/التدريبي" value={activity.awarenessGoal} area required onChange={(v) => canEdit && update("awarenessGoal", v)} /></div>
          <div className="md:col-span-2"><Text label="نتيجة التوعية/التعلّم (توثَّق بعد التنفيذ)" value={activity.outcomeDescription} area onChange={(v) => canEdit && update("outcomeDescription", v)} /></div>
        </CardContent>
        {activity.annualPlanActivityName ? <CardContent className="pt-0"><p className="rounded-lg bg-primary-50 p-3 text-xs"><Link2 className="ml-1 inline h-4 w-4" />مرتبط بنشاط الخطة السنوية: {String(activity.annualPlanActivityName)} — لا يمثل نشاطًا مكررًا.</p></CardContent> : null}
      </Card>
    </div>
  );
}

function TasksPanel({ rows, users, canEdit, add, update }: { rows: Row[]; users: UserOption[]; canEdit: boolean; add: (row: Row) => void; update: (index: number, patch: Row) => void }) {
  const [preset, setPreset] = useState<string>(TASK_PRESETS[0]);
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><CardTitle>توزيع مهام تنظيم النشاط</CardTitle><p className="mt-1 text-xs text-muted">المهام المسندة لمستخدم منصة تظهر في «مهامي» بعد الحفظ وتفتح مساحة هذا النشاط مباشرة.</p></div>
          {canEdit ? (
            <div className="flex flex-wrap items-center gap-2">
              <select value={preset} onChange={(event) => setPreset(event.target.value)} className="h-9 rounded-lg border bg-transparent px-2 text-xs">{TASK_PRESETS.map((item) => <option key={item} value={item}>{item}</option>)}</select>
              <Button size="sm" onClick={() => add({ id: newId("task"), title: preset, description: "", assignedUserId: "", assignee: "", priority: "MEDIUM", assignedAt: new Date().toISOString().slice(0, 10), dueDate: "", status: "NOT_STARTED", nextAction: "فتح مساحة النشاط" })}><Plus className="h-4 w-4" />إضافة مهمة</Button>
            </div>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.map((row, index) => (
          <div key={String(row.id)} id={`task-${String(row.id)}`} className="grid gap-3 rounded-xl border p-4 md:grid-cols-4">
            <Text label="المهمة" value={row.title} required onChange={(v) => update(index, { title: v })} />
            <label className="text-xs font-semibold">مستخدم المنصة<select disabled={!canEdit} value={String(row.assignedUserId || "")} onChange={(event) => { const user = users.find((item) => item.id === event.target.value); update(index, { assignedUserId: event.target.value, assignee: user?.name || row.assignee }); }} className="mt-1 h-9 w-full rounded-lg border bg-transparent px-3 text-xs"><option value="">مسؤول نصي فقط</option>{users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></label>
            <Text label="الموعد النهائي" type="date" value={row.dueDate} onChange={(v) => update(index, { dueDate: v })} />
            <Select label="الحالة" value={row.status} values={Object.keys(TASK_STATUS_LABELS)} labels={TASK_STATUS_LABELS} onChange={(v) => update(index, { status: v, completedAt: v === "COMPLETED" ? new Date().toISOString() : null })} />
            <div className="md:col-span-4"><Text label="الوصف/الملاحظات" value={row.description} area onChange={(v) => update(index, { description: v })} /></div>
          </div>
        ))}
        {!rows.length ? <p className="rounded-lg border border-dashed p-6 text-center text-xs text-muted">لا توجد مهام بعد.</p> : null}
      </CardContent>
    </Card>
  );
}

function Meetings({ rows, canEdit, add, createTask, update }: { rows: Row[]; canEdit: boolean; add: (row: Row) => void; createTask: (row: Row) => void; update: (index: number, patch: Row) => void }) {
  return (
    <Card>
      <CardHeader><div className="flex justify-between"><CardTitle>اللقاءات والاجتماعات</CardTitle>{canEdit ? <Button size="sm" onClick={() => add({ id: newId("meeting"), name: "لقاء جديد", type: "تحضيري", date: "", location: "", organizer: "", decisions: "" })}><Plus className="h-4 w-4" />إضافة لقاء</Button> : null}</div></CardHeader>
      <CardContent className="space-y-3">
        {rows.map((row, index) => (
          <div key={String(row.id)} className="rounded-xl border p-4">
            <div className="grid gap-3 md:grid-cols-4"><Text label="اسم اللقاء" value={row.name} onChange={(v) => update(index, { name: v })} /><Text label="النوع" value={row.type} onChange={(v) => update(index, { type: v })} /><Text label="التاريخ" type="date" value={row.date} onChange={(v) => update(index, { date: v })} /><Text label="المكان/الرابط" value={row.location} onChange={(v) => update(index, { location: v })} /></div>
            <div className="mt-3"><Text label="القرارات والملاحظات" value={row.decisions} area onChange={(v) => update(index, { decisions: v })} /></div>
            {canEdit ? <Button className="mt-3" size="sm" variant="outline" onClick={() => createTask({ id: newId("task"), title: `متابعة: ${String(row.name)}`, assignee: String(row.organizer || ""), status: "NOT_STARTED", priority: "MEDIUM", assignedAt: new Date().toISOString().slice(0, 10), dueDate: "", nextAction: "تنفيذ قرار الاجتماع" })}>إنشاء مهمة متابعة</Button> : null}
          </div>
        ))}
        {!rows.length ? <p className="rounded-lg border border-dashed p-6 text-center text-xs text-muted">لا توجد لقاءات بعد.</p> : null}
      </CardContent>
    </Card>
  );
}

function Files({ rows, canEdit, add, update }: { rows: Row[]; canEdit: boolean; add: (row: Row) => void; update: (index: number, patch: Row) => void }) {
  return (
    <Card>
      <CardHeader><div className="flex justify-between"><div><CardTitle>الملفات والمواد المعرفية</CardTitle><p className="mt-1 text-xs text-muted">عروض تقديمية، أدلة، تصاميم توعوية، روابط تسجيل. مادة تشغيلية؛ لا تصبح دليل متطلب رسمي إلا عند ربطها صراحة ورفعها في مستودع الإثبات.</p></div>{canEdit ? <Button size="sm" onClick={() => add({ id: newId("file"), title: "ملف جديد", category: "عرض تقديمي", fileName: "", reviewState: "مسودة", markedAsEvidence: "لا" })}><Plus className="h-4 w-4" />إضافة ملف</Button> : null}</div></CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2">
        {rows.map((row, index) => (
          <div key={String(row.id)} className="rounded-xl border p-4">
            <Text label="العنوان" value={row.title} onChange={(v) => update(index, { title: v })} />
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Select label="الفئة" value={row.category} values={["عرض تقديمي", "دليل", "تصميم توعوي", "رابط تسجيل", "مادة تدريبية"]} onChange={(v) => update(index, { category: v })} />
              <Text label="اسم الملف/الرابط" value={row.fileName} onChange={(v) => update(index, { fileName: v })} />
              <Select label="حالة المراجعة" value={row.reviewState} values={["مسودة", "قيد المراجعة", "يحتاج تعديل", "معتمد"]} onChange={(v) => update(index, { reviewState: v })} />
              <Select label="مرشح للإثبات" value={row.markedAsEvidence} values={["لا", "نعم"]} onChange={(v) => update(index, { markedAsEvidence: v })} />
            </div>
          </div>
        ))}
        {!rows.length ? <p className="col-span-full rounded-lg border border-dashed p-6 text-center text-xs text-muted">لا توجد ملفات أو مواد بعد.</p> : null}
      </CardContent>
    </Card>
  );
}

function ActivityReport({ activity, evidence }: { activity: Row; evidence: EvidenceRow[] }) {
  const tasks = arr(activity.tasks);
  const relatedEvidence = evidence.filter((item) => item.relatedRecord === activity.name);
  const rows: [string, string][] = [
    ["النشاط", String(activity.name || "—")],
    ["التاريخ", `${String(activity.startDate || "—")} — ${String(activity.endDate || "—")}`],
    ["الهدف", String(activity.awarenessGoal || "—")],
    ["الفئة المستهدفة", String(activity.targetSegment || "—")],
    ["مقدم/مدرب", String(activity.presenter || "—")],
    ["المشاركون", `${arr(activity.participants).length} مشارك موثَّق`],
    ["المواد", `${arr(activity.files).length} ملف/مادة، منها ${arr(activity.files).filter((f) => f.markedAsEvidence === "نعم").length} مرشَّح للإثبات`],
    ["المخرجات", `${arr(activity.outputs).length} مخرج موثَّق`],
    ["المهام", `${tasks.filter((t) => t.status === "COMPLETED").length} من ${tasks.length} مكتملة`],
    ["الإنجاز", String(activity.status || "—")],
    ["الأدلة", relatedEvidence.length ? `${relatedEvidence.length} دليل مرتبط، ${relatedEvidence.filter((e) => e.reviewStatus === "APPROVED").length} معتمد` : "لا يوجد دليل مرتبط بعد"],
  ];
  return (
    <Card>
      <CardHeader><CardTitle>تقرير الإنجاز</CardTitle><p className="mt-1 text-xs text-muted">مُولَّد آليًا من بيانات النشاط الفعلية — لا يتضمن أي رقم أو حالة غير موثقة.</p></CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2">
        {rows.map(([label, value]) => <div key={label} className="rounded-xl border p-3"><p className="text-xs font-semibold text-muted">{label}</p><p className="mt-1 text-sm leading-6">{value}</p></div>)}
      </CardContent>
    </Card>
  );
}

function Closure({ activity, evidence, canEdit, onClose }: { activity: Row; evidence: EvidenceRow[]; canEdit: boolean; onClose: () => void }) {
  const relatedEvidence = evidence.filter((item) => item.relatedRecord === activity.name);
  const checks: [string, boolean][] = [
    ["المهام الأساسية", !arr(activity.tasks).some((row) => !["COMPLETED", "CANCELLED"].includes(String(row.status)))],
    ["المخرجات موثَّقة", arr(activity.outputs).length > 0],
    ["مادة مرشَّحة للإثبات", arr(activity.files).some((row) => row.markedAsEvidence === "نعم")],
    ["دليل رسمي مرفوع", relatedEvidence.length > 0],
    ["دليل رسمي معتمد", relatedEvidence.some((item) => item.reviewStatus === "APPROVED")],
  ];
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>الأدلة والإغلاق</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">{checks.map(([label, done]) => <p key={label} className="flex items-center gap-2 rounded-lg border p-3 text-sm">{done ? <CheckCircle2 className="h-4 w-4 text-success" /> : <AlertTriangle className="h-4 w-4 text-warning" />}{label}<Badge className="mr-auto" variant={done ? "success" : "warning"}>{done ? "مكتمل" : "ناقص"}</Badge></p>)}</div>
          {canEdit ? <Button className="mt-4" onClick={onClose}>إغلاق النشاط</Button> : null}
          <p className="mt-3 text-xs text-muted">الإغلاق داخل المنصة توثيق تشغيلي ولا يمثل اعتمادًا رسميًا من هيئة الحكومة الرقمية.</p>
        </CardContent>
      </Card>
    </div>
  );
}

function Log({ rows }: { rows: Row[] }) {
  return (
    <Card>
      <CardHeader><CardTitle>سجل النشاط</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {rows.map((row, index) => <p key={index} className="rounded-lg border p-3 text-xs"><b>{row.date ? new Date(String(row.date)).toLocaleString("ar-SA") : "—"}</b> · {String(row.action)}</p>)}
        {!rows.length ? <p className="rounded-lg border border-dashed p-6 text-center text-xs text-muted">لا توجد أحداث مسجَّلة بعد.</p> : null}
      </CardContent>
    </Card>
  );
}
