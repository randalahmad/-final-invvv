"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, FileSearch, Plus, Users2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { WorkspaceData } from "../workspace-status";

type Row = Record<string, unknown>;
type Structure = Row & { id: string; name: string; type: string; status: string; members?: Row[]; tasks?: Row[]; log?: Row[] };
type EvidenceRow = { id: string; classification: string | null; reviewStatus: string; relatedRecord?: string | null };

const tabs = ["نظرة عامة", "التشكيل والقرار", "الأعضاء", "الأدوار والمسؤوليات", "المهام", "الأدلة والوثائق", "السجل"] as const;
const STATUS_LABELS: Record<string, string> = { "مُقترَحة": "مُقترَحة", "نشطة": "نشطة", "منحلّة": "منحلّة" };
const MEMBER_CATEGORIES = ["موظف", "ممثل إدارة", "خبير", "عضو خارجي", "طالب", "طالب متطوع", "متطوع", "فئة أخرى"];
const MEMBER_STATUSES = ["نشط", "منتهي", "موقوف"];
const TASK_STATUS_LABELS: Record<string, string> = { NOT_STARTED: "لم تبدأ", IN_PROGRESS: "قيد التنفيذ", WAITING: "بانتظار طرف آخر", REVIEW: "بانتظار مراجعة", COMPLETED: "مكتملة", OVERDUE: "متأخرة", CANCELLED: "ملغاة" };
const newId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const arr = (value: unknown) => (Array.isArray(value) ? (value as Row[]) : []);
const EditContext = createContext(true);

function Text({ label, value, onChange, area = false, type = "text", disabled = false, required = false }: { label: string; value: unknown; onChange: (value: string) => void; area?: boolean; type?: string; disabled?: boolean; required?: boolean }) {
  const editable = useContext(EditContext);
  const locked = disabled || !editable;
  return (
    <label className="text-xs font-semibold">
      {label}
      {required ? <span className="text-danger"> *</span> : null}
      {area ? (
        <textarea disabled={locked} value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} className="mt-1 min-h-20 w-full rounded-lg border bg-transparent p-3 disabled:cursor-not-allowed disabled:opacity-70" />
      ) : (
        <input disabled={locked} type={type} value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} className="mt-1 h-10 w-full rounded-lg border bg-transparent px-3 disabled:cursor-not-allowed disabled:opacity-70" />
      )}
    </label>
  );
}
function Select({ label, value, values, labels, onChange, disabled = false, required = false }: { label: string; value: unknown; values: string[]; labels?: Record<string, string>; onChange: (value: string) => void; disabled?: boolean; required?: boolean }) {
  const editable = useContext(EditContext);
  return (
    <label className="text-xs font-semibold">
      {label}
      {required ? <span className="text-danger"> *</span> : null}
      <select disabled={disabled || !editable} value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} className="mt-1 h-10 w-full rounded-lg border bg-transparent px-3 disabled:cursor-not-allowed disabled:opacity-70">
        <option value="">اختر</option>
        {values.map((item) => (
          <option key={item} value={item}>
            {labels?.[item] ?? item}
          </option>
        ))}
      </select>
    </label>
  );
}
function YesNo({ label, value, onChange, disabled = false }: { label: string; value: unknown; onChange: (value: string) => void; disabled?: boolean }) {
  return <Select label={label} value={value} values={["نعم", "لا"]} onChange={onChange} disabled={disabled} />;
}

export function CommitteeWorkspace({ data, canEdit, onChange, personaKey = "", users = [], evidence = [] }: { data: WorkspaceData; canEdit: boolean; onChange: (data: WorkspaceData) => void; personaKey?: string; users?: { id: string; name: string; email: string }[]; evidence?: EvidenceRow[] }) {
  const structures = useMemo(() => (Array.isArray(data.structures) ? data.structures : []) as Structure[], [data.structures]);
  const [selected, setSelected] = useState(0);
  const [tab, setTab] = useState<(typeof tabs)[number]>(tabs[0]);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const committeeId = new URLSearchParams(window.location.search).get("committeeId");
    if (!committeeId) return;
    const index = structures.findIndex((item) => item.committeeId === committeeId || item.id === committeeId);
    if (index >= 0) {
      setSelected(index);
      setTab("المهام");
    }
  }, [structures]);
  const structure = structures[selected];
  const availableTabs = personaKey === "viewer" ? tabs.filter((item) => item !== "السجل") : personaKey === "partner" ? tabs.filter((item) => !["الأدوار والمسؤوليات", "السجل"].includes(item)) : tabs;

  const update = (key: string, value: unknown) => onChange({ ...data, structures: structures.map((item, index) => (index === selected ? { ...item, [key]: value } : item)) });
  const addStructure = () => {
    const next: Structure = { id: newId("structure"), name: "وحدة/لجنة ابتكار جديدة", type: "لجنة", status: "مُقترَحة", members: [], tasks: [], log: [{ date: new Date().toISOString(), action: "إنشاء مسودة الوحدة/اللجنة" }] };
    onChange({ ...data, structures: [...structures, next] });
    setSelected(structures.length);
    setTab("نظرة عامة");
    setNotice("أُضيفت وحدة/لجنة جديدة. أكمل بيانات التشكيل ثم احفظ التحديث.");
  };
  const addRecord = (key: "members" | "tasks" | "log", row: Row) => update(key, [...arr(structure?.[key]), row]);
  const updateRecord = (key: "members" | "tasks", index: number, patch: Row) => update(key, arr(structure?.[key]).map((row, i) => (i === index ? { ...row, ...patch } : row)));
  const pushLog = (action: string) => addRecord("log", { date: new Date().toISOString(), action });

  const members = arr(structure?.members);
  const activeMembers = members.filter((m) => m.status !== "منتهي");
  const tasks = arr(structure?.tasks);
  const openTasks = tasks.filter((t) => !["COMPLETED", "CANCELLED"].includes(String(t.status)));
  const hasApprovedStructureEvidence = evidence.some((item) => item.classification === "APPROVED_COMMITTEE_STRUCTURE" && item.reviewStatus === "APPROVED");
  const gaps = [
    !structure?.decisionNumber && !structure?.decisionDate ? "لا يوجد قرار تشكيل موثّق بعد" : null,
    !members.length ? "لم يُضف أي عضو بعد" : null,
    !structure?.chairName ? "لم يُحدَّد رئيس/مسؤول الوحدة/اللجنة" : null,
    !hasApprovedStructureEvidence ? "لم يُعتمد بعد دليل الهيكل التنظيمي" : null,
  ].filter(Boolean) as string[];
  const nextAction = gaps[0] ?? (openTasks.length ? `متابعة ${openTasks.length} مهمة مفتوحة` : "لا يوجد إجراء عاجل — تابع مراجعة الأدلة والاعتماد");

  return (
    <EditContext.Provider value={canEdit}>
      <Card className="border-primary/20">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users2 className="h-4 w-4" /> وحدات ولجان الابتكار
              </CardTitle>
              <p className="mt-1 text-xs text-muted">هذا المتطلب هو مصدر الحقيقة الوحيد لبيانات الوحدة/اللجنة؛ لا تُنشأ لجان مكررة من المتطلب 02.</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="primary">{structures.length} وحدة/لجنة</Badge>
              {canEdit ? (
                <Button size="sm" onClick={addStructure}>
                  <Plus className="h-4 w-4" />
                  إضافة وحدة / لجنة
                </Button>
              ) : null}
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-2">
          {structures.map((item, index) => {
            const itemMembers = arr(item.members);
            const itemTasks = arr(item.tasks).filter((t) => !["COMPLETED", "CANCELLED"].includes(String(t.status)));
            return (
              <button key={item.id} type="button" onClick={() => { setSelected(index); setTab("نظرة عامة"); }} className={`rounded-xl border p-4 text-start transition ${selected === index ? "border-primary bg-primary-50/40" : "hover:border-primary/40"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold">{String(item.name || `وحدة/لجنة ${index + 1}`)}</p>
                    <p className="mt-1 text-xs text-muted">{String(item.type || "—")} · {String(item.chairName || "لم يُحدَّد رئيس")}</p>
                  </div>
                  <Badge variant={item.status === "نشطة" ? "success" : item.status === "منحلّة" ? "neutral" : "warning"}>{STATUS_LABELS[String(item.status)] ?? String(item.status || "—")}</Badge>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-1 text-xs">
                  <p><b>الأعضاء:</b> {itemMembers.length}</p>
                  <p><b>مهام مفتوحة:</b> {itemTasks.length}</p>
                  <p><b>قرار التشكيل:</b> {item.decisionNumber ? String(item.decisionNumber) : "غير موثّق"}</p>
                  <p><b>الإدارة المرتبطة:</b> {String(item.relatedDepartmentName || "—")}</p>
                </div>
              </button>
            );
          })}
          {!structures.length ? <p className="col-span-full p-8 text-center text-sm text-muted">لا توجد وحدات أو لجان بعد. أضف أول وحدة/لجنة للبدء.</p> : null}
        </CardContent>
      </Card>

      {structure ? (
        <Card className="mt-5">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle>{structure.name}</CardTitle>
                <p className="mt-1 text-xs text-muted">أعضاء اللجنة ليسوا مستخدمي منصة تلقائيًا؛ ومساهمو توثيق المتطلب منفصلون عن أعضاء الوحدة/اللجنة.</p>
              </div>
              <Badge variant="primary">{STATUS_LABELS[String(structure.status)] ?? String(structure.status || "—")}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {availableTabs.map((item) => (
                <Button key={item} size="sm" variant={tab === item ? "default" : "outline"} onClick={() => setTab(item)}>
                  {item}
                </Button>
              ))}
            </div>
            <div className="mt-5">
              {tab === "نظرة عامة" ? (
                <Overview structure={structure} members={members} activeMembers={activeMembers} openTasks={openTasks} gaps={gaps} nextAction={nextAction} />
              ) : tab === "التشكيل والقرار" ? (
                <Formation structure={structure} update={update} />
              ) : tab === "الأعضاء" ? (
                <Members members={members} canEdit={canEdit} add={() => { addRecord("members", { id: newId("member"), name: "", category: "موظف", status: "نشط", joinDate: new Date().toISOString().slice(0, 10) }); pushLog("إضافة عضو جديد"); }} update={(index, patch) => updateRecord("members", index, patch)} />
              ) : tab === "الأدوار والمسؤوليات" ? (
                <Responsibilities members={members} canEdit={canEdit} update={(index, patch) => updateRecord("members", index, patch)} />
              ) : tab === "المهام" ? (
                <Tasks rows={tasks} users={users} canEdit={canEdit} add={(row) => { addRecord("tasks", row); pushLog(`إسناد مهمة: ${String(row.title)}`); }} update={(index, patch) => { updateRecord("tasks", index, patch); if (patch.status === "COMPLETED") pushLog(`إكمال مهمة: ${String(tasks[index]?.title ?? "")}`); }} />
              ) : tab === "الأدلة والوثائق" ? (
                <Evidence evidence={evidence} gaps={gaps} />
              ) : (
                <Log rows={arr(structure.log)} />
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}
      {notice ? <p className="mt-3 rounded-lg bg-primary-50 p-3 text-xs">{notice}</p> : null}
    </EditContext.Provider>
  );
}

function Overview({ structure, members, activeMembers, openTasks, gaps, nextAction }: { structure: Structure; members: Row[]; activeMembers: Row[]; openTasks: Row[]; gaps: string[]; nextAction: string }) {
  const rows: [string, string][] = [
    ["ما الوحدة/اللجنة؟", `${String(structure.name || "—")} (${String(structure.type || "—")})`],
    ["لماذا شُكلت؟", String(structure.purpose || "لم يُحدَّد الغرض بعد")],
    ["من يرأسها؟", String(structure.chairName || "لم يُحدَّد")],
    ["كم عضوًا؟", `${activeMembers.length} عضو نشط من أصل ${members.length}`],
    ["هل التشكيل موثّق؟", structure.decisionNumber || structure.decisionDate ? "نعم — يوجد قرار تشكيل مسجَّل" : "لا — لا يوجد قرار تشكيل موثّق"],
    ["ما المهام المفتوحة؟", openTasks.length ? `${openTasks.length} مهمة مفتوحة` : "لا توجد مهام مفتوحة"],
    ["ما الناقص؟", gaps.length ? gaps.join("، ") : "لا يوجد نقص ظاهر"],
    ["ما الإجراء التالي؟", nextAction],
  ];
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label} className="rounded-xl border p-4">
          <p className="text-xs font-semibold text-muted">{label}</p>
          <p className="mt-1 text-sm leading-6">{value}</p>
        </div>
      ))}
    </div>
  );
}

function Formation({ structure, update }: { structure: Structure; update: (key: string, value: unknown) => void }) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-bold">بيانات الوحدة/اللجنة</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <Text label="الاسم" value={structure.name} required onChange={(v) => update("name", v)} />
          <Select label="النوع" value={structure.type} values={["وحدة", "لجنة"]} required onChange={(v) => update("type", v)} />
          <Text label="الغرض" value={structure.purpose} area required onChange={(v) => update("purpose", v)} />
          <Text label="وصف الاختصاص" value={structure.mandateDescription} area required onChange={(v) => update("mandateDescription", v)} />
          <Text label="الجهة/الإدارة المرتبطة" value={structure.relatedDepartmentName} required onChange={(v) => update("relatedDepartmentName", v)} />
          <Select label="الحالة" value={structure.status} values={["مُقترَحة", "نشطة", "منحلّة"]} required onChange={(v) => update("status", v)} />
          <Text label="الرئيس/المسؤول" value={structure.chairName} required onChange={(v) => update("chairName", v)} />
          <Text label="أمين اللجنة (عند وجوده)" value={structure.secretaryName} onChange={(v) => update("secretaryName", v)} />
          <Text label="تاريخ التشكيل" type="date" value={structure.formationDate} required onChange={(v) => update("formationDate", v)} />
          <Text label="تاريخ بداية العمل" type="date" value={structure.operationStartDate} onChange={(v) => update("operationStartDate", v)} />
          <Text label="دورية الاجتماعات (عند تحديدها)" value={structure.meetingFrequency} onChange={(v) => update("meetingFrequency", v)} />
          <Text label="ملاحظات" value={structure.notes} area onChange={(v) => update("notes", v)} />
        </div>
      </div>
      <div>
        <h3 className="font-bold">قرار التشكيل</h3>
        <p className="text-xs text-muted">في حال عدم وجود رقم قرار رسمي، اترك الحقل فارغًا — لا تُختلق قرارات.</p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <Text label="رقم القرار" value={structure.decisionNumber} onChange={(v) => update("decisionNumber", v)} />
          <Text label="تاريخ القرار" type="date" value={structure.decisionDate} onChange={(v) => update("decisionDate", v)} />
          <Text label="جهة الاعتماد" value={structure.decisionApprovingAuthority} onChange={(v) => update("decisionApprovingAuthority", v)} />
          <Text label="تاريخ السريان" type="date" value={structure.decisionEffectiveDate} onChange={(v) => update("decisionEffectiveDate", v)} />
          <Text label="ملاحظات القرار" value={structure.decisionNotes} area onChange={(v) => update("decisionNotes", v)} />
        </div>
      </div>
    </div>
  );
}

function Members({ members, canEdit, add, update }: { members: Row[]; canEdit: boolean; add: () => void; update: (index: number, patch: Row) => void }) {
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-bold">الأعضاء</h3>
          <p className="text-xs text-muted">عضو اللجنة ليس مستخدم منصة تلقائيًا — يمكن تسجيل طلاب متطوعين وخبراء خارجيين دون منحهم دخولًا.</p>
        </div>
        {canEdit ? (
          <Button size="sm" onClick={add}>
            <Plus className="h-4 w-4" />
            إضافة عضو
          </Button>
        ) : null}
      </div>
      <div className="mt-4 space-y-3">
        {members.map((row, index) => (
          <div key={String(row.id)} className="grid gap-3 rounded-xl border p-4 md:grid-cols-3">
            <Text label="الاسم" value={row.name} required onChange={(v) => update(index, { name: v })} />
            <Select label="الفئة" value={row.category} values={MEMBER_CATEGORIES} required onChange={(v) => update(index, { category: v })} />
            <Text label="الجهة/الجامعة/الإدارة" value={row.affiliation} onChange={(v) => update(index, { affiliation: v })} />
            <Text label="المسمى" value={row.title} onChange={(v) => update(index, { title: v })} />
            <Text label="البريد" type="email" value={row.email} onChange={(v) => update(index, { email: v })} />
            <Text label="الهاتف (اختياري)" value={row.phone} onChange={(v) => update(index, { phone: v })} />
            <Text label="تاريخ الانضمام" type="date" value={row.joinDate} onChange={(v) => update(index, { joinDate: v })} />
            <Text label="تاريخ انتهاء العضوية (اختياري)" type="date" value={row.membershipEndDate} onChange={(v) => update(index, { membershipEndDate: v })} />
            <Select label="الحالة" value={row.status} values={MEMBER_STATUSES} onChange={(v) => update(index, { status: v })} />
            <div className="md:col-span-3">
              <Text label="ملاحظات" value={row.notes} area onChange={(v) => update(index, { notes: v })} />
            </div>
          </div>
        ))}
        {!members.length ? <p className="rounded-lg border border-dashed p-6 text-center text-xs text-muted">لا يوجد أعضاء مضافون بعد.</p> : null}
      </div>
    </div>
  );
}

function Responsibilities({ members, canEdit, update }: { members: Row[]; canEdit: boolean; update: (index: number, patch: Row) => void }) {
  return (
    <div>
      <h3 className="font-bold">الأدوار والمسؤوليات</h3>
      <p className="text-xs text-muted">وثّق الدور والمسؤوليات ونطاقها لكل عضو، مع تحديد المسؤول الرئيسي وبديله عند الحاجة — دون فرض مصفوفة RACI حيث لا تناسب.</p>
      <div className="mt-4 space-y-3">
        {members.map((row, index) => (
          <div key={String(row.id)} className="grid gap-3 rounded-xl border p-4 md:grid-cols-2">
            <div className="md:col-span-2 flex items-center justify-between">
              <p className="font-semibold">{String(row.name || `عضو ${index + 1}`)}</p>
              {String(row.isPrimaryResponsible) === "نعم" ? <Badge variant="success">مسؤول رئيسي</Badge> : null}
            </div>
            <Text label="الدور داخل اللجنة" value={row.roleInCommittee} onChange={(v) => update(index, { roleInCommittee: v })} />
            <Text label="نطاق المسؤولية" value={row.responsibilityScope} onChange={(v) => update(index, { responsibilityScope: v })} />
            <div className="md:col-span-2">
              <Text label="المسؤوليات" value={row.responsibilities} area onChange={(v) => update(index, { responsibilities: v })} />
            </div>
            <YesNo label="هل هو مسؤول رئيسي؟" value={row.isPrimaryResponsible} onChange={(v) => update(index, { isPrimaryResponsible: v })} disabled={!canEdit} />
            <Text label="البديل (عند وجوده)" value={row.delegateName} onChange={(v) => update(index, { delegateName: v })} />
          </div>
        ))}
        {!members.length ? <p className="rounded-lg border border-dashed p-6 text-center text-xs text-muted">أضف أعضاء أولًا من تبويب «الأعضاء» لتوثيق أدوارهم.</p> : null}
      </div>
    </div>
  );
}

function Tasks({ rows, users, canEdit, add, update }: { rows: Row[]; users: { id: string; name: string; email: string }[]; canEdit: boolean; add: (row: Row) => void; update: (index: number, patch: Row) => void }) {
  return (
    <div>
      <div className="flex justify-between">
        <div>
          <h3 className="font-bold">توزيع المهام والمتابعة</h3>
          <p className="text-xs text-muted">المهام المسندة لمستخدم منصة تظهر في «مهامي» بعد الحفظ، وتفتح مباشرة على هذه الوحدة/اللجنة.</p>
        </div>
        {canEdit ? (
          <Button size="sm" onClick={() => add({ id: newId("task"), title: "مهمة جديدة", description: "", assignee: "", assignedUserId: "", priority: "MEDIUM", assignedAt: new Date().toISOString().slice(0, 10), dueDate: "", status: "NOT_STARTED", nextAction: "فتح المهمة" })}>
            <Plus className="h-4 w-4" />
            إضافة مهمة
          </Button>
        ) : null}
      </div>
      <div className="mt-4 space-y-3">
        {rows.map((row, index) => (
          <div key={String(row.id)} className="grid gap-3 rounded-xl border p-4 md:grid-cols-4">
            <Text label="المهمة" value={row.title} required onChange={(v) => update(index, { title: v })} />
            <label className="text-xs font-semibold">
              المسؤول (مستخدم المنصة)
              <select disabled={!canEdit} value={String(row.assignedUserId || "")} onChange={(event) => { const user = users.find((item) => item.id === event.target.value); update(index, { assignedUserId: event.target.value, assignee: user?.name || row.assignee }); }} className="mt-1 h-10 w-full rounded-lg border bg-transparent px-3">
                <option value="">مسؤول نصي فقط</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </label>
            <Text label="الموعد النهائي" type="date" value={row.dueDate} onChange={(v) => update(index, { dueDate: v })} />
            <Select label="الحالة" value={row.status} values={Object.keys(TASK_STATUS_LABELS)} labels={TASK_STATUS_LABELS} onChange={(v) => update(index, { status: v, completedAt: v === "COMPLETED" ? new Date().toISOString() : null })} />
            <div className="md:col-span-3">
              <Text label="الوصف/المرفقات والملاحظات" value={row.description} area onChange={(v) => update(index, { description: v })} />
            </div>
            <div className="rounded-lg bg-slate-50 p-3 text-xs dark:bg-white/5">
              <b>{TASK_STATUS_LABELS[String(row.status)] ?? String(row.status)}</b>
              <p>أُسندت: {String(row.assignedAt || "—")}</p>
              <p>أُنجزت: {row.completedAt ? new Date(String(row.completedAt)).toLocaleDateString("ar-SA") : "—"}</p>
            </div>
          </div>
        ))}
        {!rows.length ? <p className="rounded-lg border border-dashed p-6 text-center text-xs text-muted">لا توجد مهام بعد. أمثلة: إعداد قرار التشكيل، استكمال بيانات عضو، رفع محضر.</p> : null}
      </div>
    </div>
  );
}

function Evidence({ evidence, gaps }: { evidence: EvidenceRow[]; gaps: string[] }) {
  const structureFiles = evidence.filter((item) => item.classification === "APPROVED_COMMITTEE_STRUCTURE");
  const approved = structureFiles.filter((item) => item.reviewStatus === "APPROVED").length;
  return (
    <div className="space-y-4">
      <div className="rounded-xl border p-4">
        <div className="flex items-center gap-3">
          <FileSearch className="h-5 w-5 text-primary" />
          <div>
            <p className="text-sm font-semibold">الهيكل التنظيمي/اللجنة المعتمد</p>
            <p className="mt-1 text-xs text-muted">{structureFiles.length} ملف مرفوع، {approved} منها معتمد. الرفع وحده لا يعني الاعتماد أو الاكتمال.</p>
          </div>
        </div>
        <div className="mt-3 space-y-2">
          {structureFiles.map((item) => (
            <p key={item.id} className="flex items-center justify-between rounded-lg bg-slate-50 p-2 text-xs dark:bg-white/5">
              <span>حالة المراجعة: {item.reviewStatus}</span>
              {item.relatedRecord ? <span className="text-muted">{item.relatedRecord}</span> : null}
            </p>
          ))}
          {!structureFiles.length ? <p className="text-xs text-muted">لم يُرفع أي ملف بعد — ارفعه من لوحة «مستندات الإثبات المطلوبة».</p> : null}
        </div>
      </div>
      <div className="rounded-xl border p-4">
        <p className="text-sm font-semibold">الإجراء التالي بشأن الأدلة</p>
        <p className="mt-1 text-xs text-muted">{gaps.length ? gaps.join("، ") : approved ? "الأدلة مكتملة ومعتمدة." : "أكمل رفع الهيكل التنظيمي وانتظر اعتماده."}</p>
      </div>
    </div>
  );
}

function Log({ rows }: { rows: Row[] }) {
  return (
    <div>
      <h3 className="font-bold">السجل</h3>
      <p className="text-xs text-muted">سجل تشغيلي خفيف لأحداث هذه الوحدة/اللجنة. سجل التدقيق الكامل والمعتمد متاح أسفل الصفحة.</p>
      <div className="mt-3 space-y-2">
        {[...rows].reverse().map((row, index) => (
          <div key={index} className="flex items-start gap-2 rounded-lg border p-3 text-xs">
            {row.action && String(row.action).includes("إكمال") ? <CheckCircle2 className="mt-0.5 h-4 w-4 text-success" /> : <AlertTriangle className="mt-0.5 h-4 w-4 text-muted" />}
            <div>
              <p>{String(row.action)}</p>
              <p className="mt-1 text-muted">{row.date ? new Date(String(row.date)).toLocaleString("ar-SA") : "—"}</p>
            </div>
          </div>
        ))}
        {!rows.length ? <p className="rounded-lg border border-dashed p-6 text-center text-xs text-muted">لا توجد أحداث مسجَّلة بعد.</p> : null}
      </div>
    </div>
  );
}
