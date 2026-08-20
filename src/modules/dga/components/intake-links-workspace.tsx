"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, Copy, Download, ExternalLink, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { WorkspaceData } from "../workspace-status";
import { INTAKE_LINK_TYPES, INTAKE_LINK_STATUSES, INTAKE_RESPONSE_STATUSES, isIntakeLinkAcceptingResponses } from "../workspace-config";

type Row = Record<string, unknown>;
type UserOption = { id: string; name: string; email: string };
type SolutionOption = { id: string; name: string };

// 5.23.3 Requirement 05 — استقبال المقترحات والتغذية الراجعة. آلية عملية
// لروابط استقبال متعددة معزولة، كل رابط بجدول ردوده الخاص فقط (بند 2/6/8) —
// وليس مسار حوكمة أفكار كامل. المستجيب العام ليس مساهمًا ولا مستخدم منصة
// (بند 12/21)؛ يُستقبل عبر src/app/feedback/[token] بمعزل تام عن هذا الملف.
const tabs = ["نظرة عامة", "حقول النموذج", "جدول الردود", "الأدلة والجاهزية", "سجل النشاط"] as const;
type Tab = (typeof tabs)[number];
const TASK_STATUS_LABELS: Record<string, string> = { NOT_STARTED: "لم تبدأ", IN_PROGRESS: "قيد التنفيذ", WAITING: "بانتظار طرف آخر", REVIEW: "بانتظار مراجعة", COMPLETED: "مكتملة", CANCELLED: "ملغاة" };
const RESPONSE_STATUS_VARIANT: Record<string, "primary" | "warning" | "success" | "neutral"> = { "جديد": "primary", "قيد المراجعة": "warning", "تم الإسناد": "warning", "تمت المعالجة": "success", "مغلق": "neutral", "غير قابل للتنفيذ": "neutral" };

const arr = (value: unknown) => (Array.isArray(value) ? (value as Row[]) : []);
const newId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const newToken = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`;
const logEntry = (action: string) => ({ date: new Date().toISOString(), action });
const DEFAULT_FORM_FIELDS: Row[] = [
  { key: "submitterName", label: "الاسم", enabled: true, required: false },
  { key: "submitterEmail", label: "البريد الإلكتروني", enabled: true, required: false },
  { key: "submitterOrg", label: "الجهة/الإدارة", enabled: true, required: false },
  { key: "attachment", label: "مرفق", enabled: true, required: false },
  { key: "consent", label: "الموافقة على مشاركة البيانات مع الجهة", enabled: false, required: false },
  { key: "customQuestion1", label: "سؤال إضافي (اختياري)", enabled: false, required: false },
];

const EditContext = createContext(true);

function Text({ label, value, onChange, area = false, type = "text", required = false }: { label: string; value: unknown; onChange: (value: string) => void; area?: boolean; type?: string; required?: boolean }) {
  const editable = useContext(EditContext);
  return (
    <label className="text-xs font-semibold">
      {label}{required ? <span className="text-danger"> *</span> : null}
      {area ? (
        <textarea disabled={!editable} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} className="mt-1 min-h-20 w-full rounded-lg border bg-transparent p-3 text-xs disabled:cursor-not-allowed disabled:opacity-70" />
      ) : (
        <input disabled={!editable} type={type} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} className="mt-1 h-9 w-full rounded-lg border bg-transparent px-3 text-xs disabled:cursor-not-allowed disabled:opacity-70" />
      )}
    </label>
  );
}
function Select({ label, value, values, onChange, required = false, placeholder = "اختر" }: { label: string; value: unknown; values: readonly string[]; onChange: (value: string) => void; required?: boolean; placeholder?: string }) {
  const editable = useContext(EditContext);
  return (
    <label className="text-xs font-semibold">
      {label}{required ? <span className="text-danger"> *</span> : null}
      <select disabled={!editable} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} className="mt-1 h-9 w-full rounded-lg border bg-transparent px-3 text-xs disabled:cursor-not-allowed disabled:opacity-70">
        <option value="">{placeholder}</option>
        {values.map((v) => <option key={v} value={v}>{v}</option>)}
      </select>
    </label>
  );
}

export function IntakeLinksWorkspace({
  data, canEdit, onChange, personaKey = "admin", users = [], evidence = [], referenceData = {}, initialLinkId, assignmentId = "", preview = false,
}: {
  data: WorkspaceData; canEdit: boolean; onChange: (data: WorkspaceData) => void; personaKey?: string;
  users?: UserOption[]; evidence?: { id: string; classification: string | null; reviewStatus: string; relatedRecord?: string | null }[];
  referenceData?: WorkspaceData; initialLinkId?: string; assignmentId?: string; preview?: boolean;
}) {
  const links = arr(data.intakeLinks);
  const initialIndex = links.findIndex((row) => row.id === initialLinkId);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(initialIndex >= 0 ? initialIndex : null);
  const [tab, setTab] = useState<Tab>("نظرة عامة");
  const [selectedResponseId, setSelectedResponseId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  const restrictedViewer = personaKey === "viewer";
  const restrictedPartner = personaKey === "partner";
  const availableTabs = restrictedPartner ? tabs.filter((t) => !["جدول الردود", "سجل النشاط"].includes(t)) : restrictedViewer ? tabs.filter((t) => t !== "سجل النشاط") : tabs;

  const solutionOptions = useMemo<SolutionOption[]>(() => arr(referenceData.solutions).map((row) => ({ id: String(row.id ?? ""), name: String(row.nameAr ?? "") })).filter((row) => row.id && row.name), [referenceData.solutions]);

  const allResponses = links.flatMap((link) => arr(link.responses));
  const activeLinks = links.filter((link) => isIntakeLinkAcceptingResponses(link));
  const openFollowUps = links.flatMap((l) => arr(l.responses)).flatMap((r) => arr(r.tasks)).filter((t) => !["COMPLETED", "CANCELLED"].includes(String(t.status))).length;
  const approvedEvidence = evidence.some((item) => item.classification === "AUTOMATED_PROPOSAL_SCREENSHOTS" && item.reviewStatus === "APPROVED");
  const readinessGaps = [
    !links.length ? "لم يُنشأ أي رابط استقبال بعد" : null,
    links.length && !activeLinks.length ? "لا يوجد رابط نشط لاستقبال ردود حاليًا" : null,
    !allResponses.length ? "لم يُستلم أي رد بعد لإثبات أن الآلية تعمل فعليًا" : null,
    !approvedEvidence ? "لا يوجد دليل معتمد يثبت الاستقبال الآلي للمقترحات والتغذية الراجعة" : null,
    openFollowUps > 0 ? `${openFollowUps} مهمة متابعة رد مفتوحة` : null,
  ].filter((item): item is string => Boolean(item));
  const nextAction = readinessGaps[0] ?? "لا يوجد نقص ظاهر — روابط الاستقبال نشطة وتستقبل ردودًا وتُتابع فعليًا.";

  function replaceLink(index: number, next: Row) { onChange({ ...data, intakeLinks: links.map((row, i) => (i === index ? next : row)) }); }
  function openLink(index: number) {
    setSelectedIndex(index); setTab("نظرة عامة"); setSelectedResponseId(null);
    const row = links[index];
    if (row?.id && typeof window !== "undefined") window.history.pushState({}, "", `/governance/requirements/5-23-3-r5/links/${row.id}${window.location.search}`);
  }
  function createLink() {
    const link: Row = {
      id: newId("intake-link"), token: newToken(), name: "رابط استقبال جديد", purpose: "", type: "كلاهما",
      relatedServiceName: "", owningDepartment: "", owner: "", targetAudience: "", startDate: new Date().toISOString().slice(0, 10), closeDate: "",
      status: "مسودة", participantDescription: "", instructions: "",
      formFields: structuredClone(DEFAULT_FORM_FIELDS), responses: [], log: [logEntry("إنشاء رابط الاستقبال")],
    };
    onChange({ ...data, intakeLinks: [...links, link] });
    setSelectedIndex(links.length); setTab("نظرة عامة");
    setNotice("أُنشئ رابط الاستقبال كمسودة. أكمل بياناته وحدد حالته «نشط» ليصبح متاحًا للاستقبال العام.");
  }
  function update(key: string, value: unknown) { if (selectedIndex === null) return; replaceLink(selectedIndex, { ...links[selectedIndex], [key]: value, log: [logEntry("تحديث بيانات رابط الاستقبال"), ...arr(links[selectedIndex]?.log)] }); }
  function updateStatus(value: string) { if (selectedIndex === null) return; replaceLink(selectedIndex, { ...links[selectedIndex], status: value, log: [logEntry(`تغيير حالة الرابط إلى «${value}»`), ...arr(links[selectedIndex]?.log)] }); }
  function updateFormFields(next: Row[]) { if (selectedIndex === null) return; replaceLink(selectedIndex, { ...links[selectedIndex], formFields: next, log: [logEntry("تحديث حقول نموذج الاستقبال"), ...arr(links[selectedIndex]?.log)] }); }

  const current = selectedIndex === null ? null : links[selectedIndex];
  const responses = arr(current?.responses);
  const selectedResponse = responses.find((row) => row.id === selectedResponseId) ?? null;

  function patchResponse(responseId: string, patch: Row, historyNote?: string) {
    if (selectedIndex === null) return;
    const next = responses.map((row) => (row.id === responseId ? { ...row, ...patch, history: historyNote ? [logEntry(historyNote), ...arr(row.history)] : arr(row.history) } : row));
    replaceLink(selectedIndex, { ...links[selectedIndex], responses: next, log: [logEntry(historyNote ?? "تحديث بيانات رد"), ...arr(links[selectedIndex]?.log)] });
  }
  function assignOwner(responseId: string, ownerUserId: string) {
    const owner = users.find((u) => u.id === ownerUserId);
    patchResponse(responseId, { ownerUserId, ownerName: owner?.name ?? "", status: "تم الإسناد" }, `إسناد الرد إلى ${owner?.name ?? "مستخدم"}`);
  }
  function updateResponseStatus(responseId: string, status: string) { patchResponse(responseId, { status }, `تحديث حالة الرد إلى «${status}»`); }
  function updateResponseNotes(responseId: string, notes: string) { patchResponse(responseId, { notes }); }
  function addFollowUpTask(responseId: string, title: string, assignedUserId: string, dueDate: string) {
    const response = responses.find((row) => row.id === responseId); if (!response || !title.trim() || !assignedUserId) return;
    const assignee = users.find((u) => u.id === assignedUserId);
    const task: Row = { id: newId("task"), title: title.trim(), assignedUserId, assignee: assignee?.name ?? "", priority: "MEDIUM", assignedAt: new Date().toISOString().slice(0, 10), dueDate, status: "NOT_STARTED", nextAction: "فتح مساحة الرد ومتابعته" };
    patchResponse(responseId, { tasks: [...arr(response.tasks), task], status: response.status === "جديد" ? "تم الإسناد" : response.status }, `إسناد مهمة متابعة إلى ${assignee?.name ?? "مستخدم"}`);
  }
  function updateFollowUpTask(responseId: string, taskId: string, patch: Row) {
    const response = responses.find((row) => row.id === responseId); if (!response) return;
    patchResponse(responseId, { tasks: arr(response.tasks).map((t) => (t.id === taskId ? { ...t, ...patch, completedAt: patch.status === "COMPLETED" ? new Date().toISOString() : t.completedAt } : t)) }, patch.status === "COMPLETED" ? "إكمال مهمة متابعة الرد" : "تحديث مهمة متابعة الرد");
  }
  function closeResponse(responseId: string) { patchResponse(responseId, { status: "مغلق" }, "إغلاق الرد"); }

  const linkEditable = canEdit && !restrictedViewer && !restrictedPartner;
  const publicOrigin = typeof window !== "undefined" ? window.location.origin : "";

  if (current === null) {
    return (
      <div className="space-y-5">
        <Card className="border-primary/20">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle>روابط استقبال المقترحات والتغذية الراجعة</CardTitle>
                <p className="mt-1 text-xs text-muted">آلية عملية لاستقبال المقترحات الابتكارية والتغذية الراجعة عبر روابط متعددة معزولة — كل رابط بردوده الخاصة فقط، دون تحويلها إلى مسار حوكمة أفكار كامل.</p>
              </div>
              {linkEditable ? <Button size="sm" onClick={createLink}><Plus className="h-4 w-4" />إنشاء رابط استقبال</Button> : null}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 text-center text-xs sm:grid-cols-4">
              {[[links.length, "روابط الاستقبال"], [activeLinks.length, "روابط نشطة"], [allResponses.length, "إجمالي الردود"], [openFollowUps, "مهمة متابعة مفتوحة"]].map(([value, label]) => (
                <div key={String(label)} className="rounded-lg border p-2"><b>{value}</b><p className="text-muted">{label}</p></div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>الجاهزية</CardTitle><p className="mt-1 text-xs text-muted">وجود واجهة الروابط لا يعني بحد ذاته امتثالًا — الجاهزية توضيح للفجوات الفعلية دون درجة مُخترعة أو حد أدنى مفروض لعدد الردود.</p></CardHeader>
          <CardContent className="space-y-2">
            {readinessGaps.length ? readinessGaps.map((gap) => <p key={gap} className="flex items-center gap-2 text-xs leading-5"><AlertTriangle className="h-4 w-4 shrink-0 text-warning" />{gap}</p>) : <p className="flex items-center gap-2 text-sm text-success"><CheckCircle2 className="h-5 w-5" />لا يوجد نقص ظاهر حاليًا.</p>}
            <p className="mt-2 rounded-lg bg-primary-50 p-3 text-xs"><b>الإجراء التالي:</b> {nextAction}</p>
          </CardContent>
        </Card>
        <div className="grid gap-4 xl:grid-cols-2">
          {[...links].reverse().map((row) => {
            const index = links.indexOf(row);
            const rowResponses = arr(row.responses);
            const counts = { new: rowResponses.filter((r) => r.status === "جديد").length, open: rowResponses.filter((r) => !["مغلق", "غير قابل للتنفيذ", "تمت المعالجة"].includes(String(r.status))).length };
            return (
              <Card key={String(row.id)}>
                <CardContent className="p-5">
                  <div className="flex flex-wrap justify-between gap-3">
                    <div>
                      <Badge variant={row.status === "نشط" ? "success" : row.status === "مغلق" ? "neutral" : "warning"}>{String(row.status || "بلا حالة")}</Badge>
                      <h3 className="mt-2 font-bold">{String(row.name || "—")}</h3>
                      <p className="mt-1 text-xs text-muted">{String(row.type || "—")} · {String(row.owningDepartment || "الإدارة غير محددة")}</p>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-muted">{rowResponses.length} رد مستلم{counts.new ? ` · ${counts.new} جديد` : ""}{counts.open ? ` · ${counts.open} قيد المتابعة` : ""}</p>
                  <div className="mt-4 flex items-center justify-end"><Button size="sm" onClick={() => openLink(index)}>فتح الرابط <ArrowLeft className="h-4 w-4" /></Button></div>
                </CardContent>
              </Card>
            );
          })}
          {!links.length ? <Card className="xl:col-span-2"><CardContent className="p-10 text-center text-sm text-muted">لا توجد روابط استقبال بعد. أنشئ أول رابط لبدء الاستقبال.</CardContent></Card> : null}
        </div>
        {notice ? <p className="rounded-lg bg-primary-50 p-3 text-sm">{notice}</p> : null}
      </div>
    );
  }

  const publicUrl = current.token ? `${publicOrigin}/feedback/${String(current.token)}` : "";
  const summary = { total: responses.length, new: responses.filter((r) => r.status === "جديد").length, review: responses.filter((r) => r.status === "قيد المراجعة").length, processedClosed: responses.filter((r) => ["تمت المعالجة", "مغلق"].includes(String(r.status))).length, assignedFollowUps: responses.flatMap((r) => arr(r.tasks)).filter((t) => !["COMPLETED", "CANCELLED"].includes(String(t.status))).length };

  return (
    <EditContext.Provider value={linkEditable}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" onClick={() => setSelectedIndex(null)}><ArrowLeft className="h-4 w-4" />روابط استقبال المقترحات والتغذية الراجعة</Button>
          <Badge variant={current.status === "نشط" ? "success" : current.status === "مغلق" ? "neutral" : "warning"}>{String(current.status || "بلا حالة")}</Badge>
        </div>
        <Card className="border-primary/20">
          <CardContent className="space-y-3 p-5">
            <div className="flex flex-wrap justify-between gap-3">
              <div><h2 className="text-xl font-bold">{String(current.name || "—")}</h2><p className="mt-1 text-xs text-muted">{String(current.type || "—")} · {String(current.owner || "المسؤول غير محدد")}</p></div>
            </div>
            {publicUrl ? (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-slate-50 p-2 text-xs">
                <span className="truncate">{publicUrl}</span>
                <Button size="sm" variant="outline" onClick={() => navigator.clipboard?.writeText(publicUrl)}><Copy className="h-3.5 w-3.5" />نسخ الرابط</Button>
                {preview ? <span className="text-muted">معاينة العرض العام غير متاحة في وضع المعاينة (بيانات تجريبية غير محفوظة فعليًا)</span> : <a href={`/feedback/${String(current.token)}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary"><ExternalLink className="h-3.5 w-3.5" />معاينة العرض العام</a>}
              </div>
            ) : null}
          </CardContent>
        </Card>
        <div className="flex gap-2 overflow-x-auto pb-2">{availableTabs.map((item) => <Button key={item} size="sm" variant={tab === item ? "default" : "outline"} onClick={() => setTab(item)}>{item}</Button>)}</div>

        {tab === "نظرة عامة" ? (
          <div className="space-y-4">
            <Card>
              <CardHeader><CardTitle>بيانات رابط الاستقبال</CardTitle></CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2">
                <Text label="اسم الرابط/الحملة" value={current.name} required onChange={(v) => update("name", v)} />
                <Select label="النوع" value={current.type} values={INTAKE_LINK_TYPES} required onChange={(v) => update("type", v)} />
                <div className="md:col-span-2"><Text label="الغرض" value={current.purpose} area required onChange={(v) => update("purpose", v)} /></div>
                <Select label="الخدمة/الحل المرتبط (اختياري — من السجلات القائمة فقط)" value={current.relatedServiceName} values={solutionOptions.map((s) => s.name)} placeholder="بلا ربط" onChange={(v) => update("relatedServiceName", v)} />
                <Text label="الإدارة المالكة" value={current.owningDepartment} required onChange={(v) => update("owningDepartment", v)} />
                <Text label="المسؤول" value={current.owner} required onChange={(v) => update("owner", v)} />
                <Text label="الجمهور المستهدف" value={current.targetAudience} required onChange={(v) => update("targetAudience", v)} />
                <Text label="تاريخ البداية" type="date" value={current.startDate} required onChange={(v) => update("startDate", v)} />
                <Text label="تاريخ الإغلاق (اختياري)" type="date" value={current.closeDate} onChange={(v) => update("closeDate", v)} />
                <Select label="حالة الرابط" value={current.status} values={INTAKE_LINK_STATUSES} required onChange={updateStatus} />
                <div className="md:col-span-2"><Text label="وصف يظهر للمشارك" value={current.participantDescription} area required onChange={(v) => update("participantDescription", v)} /></div>
                <div className="md:col-span-2"><Text label="تعليمات (اختياري)" value={current.instructions} area onChange={(v) => update("instructions", v)} /></div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>ملخص أساسي</CardTitle><p className="mt-1 text-xs text-muted">أعداد فعلية فقط — بلا تحليل مشاعر أو درجات رضا مُختلقة.</p></CardHeader>
              <CardContent className="grid grid-cols-2 gap-2 text-center text-xs sm:grid-cols-5">
                {[[summary.total, "إجمالي الردود"], [summary.new, "جديد"], [summary.review, "قيد المراجعة"], [summary.processedClosed, "معالجة/مغلقة"], [summary.assignedFollowUps, "متابعة مسندة"]].map(([value, label]) => (
                  <div key={String(label)} className="rounded-lg border p-2"><b>{value}</b><p className="text-muted">{label}</p></div>
                ))}
              </CardContent>
            </Card>
          </div>
        ) : null}

        {tab === "حقول النموذج" ? <FormFieldsTab fields={arr(current.formFields)} update={updateFormFields} /> : null}

        {tab === "جدول الردود" && !restrictedPartner ? (
          <ResponsesTab
            responses={responses}
            selectedResponse={selectedResponse}
            setSelectedResponseId={setSelectedResponseId}
            users={users}
            maskPii={restrictedViewer}
            canEdit={linkEditable}
            assignOwner={assignOwner}
            updateResponseStatus={updateResponseStatus}
            updateResponseNotes={updateResponseNotes}
            addFollowUpTask={addFollowUpTask}
            updateFollowUpTask={updateFollowUpTask}
            closeResponse={closeResponse}
            assignmentId={assignmentId}
            linkId={String(current.id)}
            preview={preview}
          />
        ) : null}

        {tab === "الأدلة والجاهزية" ? <EvidenceReadinessTab current={current} responses={responses} evidence={evidence} /> : null}

        {tab === "سجل النشاط" && !restrictedPartner && !restrictedViewer ? <Log rows={arr(current.log)} /> : null}

        {notice ? <p className="rounded-lg bg-primary-50 p-3 text-sm">{notice}</p> : null}
      </div>
    </EditContext.Provider>
  );
}

function FormFieldsTab({ fields, update }: { fields: Row[]; update: (next: Row[]) => void }) {
  const canEdit = useContext(EditContext);
  const rows = fields.length ? fields : DEFAULT_FORM_FIELDS;
  function patch(key: string, patch: Row) { update(rows.map((row) => (row.key === key ? { ...row, ...patch } : row))); }
  return (
    <Card>
      <CardHeader><CardTitle>حقول نموذج الاستقبال</CardTitle><p className="mt-1 text-xs text-muted">تفعيل/تعطيل الحقول الأساسية وتحديد الإلزامي منها — إعداد خفيف لهذه القائمة الثابتة فقط، وليس أداة بناء نماذج عامة. العنوان والوصف إلزاميان دائمًا في العرض العام.</p></CardHeader>
      <CardContent className="space-y-3">
        {rows.map((row) => (
          <div key={String(row.key)} className="grid items-center gap-3 rounded-xl border p-3 sm:grid-cols-4">
            <div className="sm:col-span-2">
              {row.key === "customQuestion1" ? <Text label="نص السؤال الإضافي" value={row.label} onChange={(v) => patch(String(row.key), { label: v })} /> : <p className="text-sm font-semibold">{String(row.label)}</p>}
            </div>
            <label className="flex items-center gap-2 text-xs font-semibold"><input type="checkbox" disabled={!canEdit} checked={Boolean(row.enabled)} onChange={(e) => patch(String(row.key), { enabled: e.target.checked })} />مفعّل في النموذج العام</label>
            <label className="flex items-center gap-2 text-xs font-semibold"><input type="checkbox" disabled={!canEdit || !row.enabled} checked={Boolean(row.required)} onChange={(e) => patch(String(row.key), { required: e.target.checked })} />إلزامي</label>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ResponsesTab({
  responses, selectedResponse, setSelectedResponseId, users, maskPii, canEdit,
  assignOwner, updateResponseStatus, updateResponseNotes, addFollowUpTask, updateFollowUpTask, closeResponse, assignmentId, linkId, preview,
}: {
  responses: Row[]; selectedResponse: Row | null; setSelectedResponseId: (id: string | null) => void; users: UserOption[]; maskPii: boolean; canEdit: boolean;
  assignOwner: (id: string, userId: string) => void; updateResponseStatus: (id: string, status: string) => void; updateResponseNotes: (id: string, notes: string) => void;
  addFollowUpTask: (id: string, title: string, userId: string, dueDate: string) => void; updateFollowUpTask: (id: string, taskId: string, patch: Row) => void; closeResponse: (id: string) => void;
  assignmentId: string; linkId: string; preview: boolean;
}) {
  const [taskTitle, setTaskTitle] = useState("");
  const [taskUser, setTaskUser] = useState("");
  const [taskDue, setTaskDue] = useState("");
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>جدول الردود</CardTitle><p className="mt-1 text-xs text-muted">ردود هذا الرابط فقط — لا تختلط مع ردود روابط استقبال أخرى.</p></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-xs">
            <thead><tr className="border-b text-muted">{["الرقم المرجعي", "تاريخ الاستلام", "النوع", "العنوان", "الخدمة", "مقدم الرد", "الحالة", "المسؤول", "الإجراء التالي"].map((h) => <th key={h} className="p-2 text-start">{h}</th>)}</tr></thead>
            <tbody>
              {responses.map((row) => {
                const submitter = row.anonymous ? "مجهول" : String(row.submitterName || row.submitterEmail || "—");
                const owner = users.find((u) => u.id === row.ownerUserId)?.name ?? (row.ownerUserId ? String(row.ownerName ?? "") : "غير مسند");
                const openTasks = arr(row.tasks).filter((t) => !["COMPLETED", "CANCELLED"].includes(String(t.status))).length;
                return (
                  <tr key={String(row.id)} className={`cursor-pointer border-b hover:bg-slate-50 ${selectedResponse?.id === row.id ? "bg-primary-50" : ""}`} onClick={() => setSelectedResponseId(row.id === selectedResponse?.id ? null : String(row.id))}>
                    <td className="p-2 font-semibold">{String(row.referenceNumber)}</td>
                    <td className="p-2">{row.receivedAt ? new Date(String(row.receivedAt)).toLocaleDateString("ar-SA") : "—"}</td>
                    <td className="p-2">{String(row.type || "—")}</td>
                    <td className="max-w-[180px] truncate p-2">{String(row.title || "—")}</td>
                    <td className="p-2">{String(row.relatedServiceName || "—")}</td>
                    <td className="p-2">{maskPii ? "محمي" : submitter}</td>
                    <td className="p-2"><Badge variant={RESPONSE_STATUS_VARIANT[String(row.status)] ?? "neutral"}>{String(row.status || "—")}</Badge></td>
                    <td className="p-2">{owner}</td>
                    <td className="p-2">{openTasks ? `${openTasks} مهمة متابعة مفتوحة` : row.status === "جديد" ? "إسناد للمراجعة" : "—"}</td>
                  </tr>
                );
              })}
              {!responses.length ? <tr><td colSpan={9} className="p-6 text-center text-muted">لا توجد ردود مستلمة بعد لهذا الرابط.</td></tr> : null}
            </tbody>
          </table>
        </CardContent>
      </Card>
      {selectedResponse ? (
        <Card id={`response-${String(selectedResponse.id)}`} className="border-primary/20">
          <CardHeader><CardTitle>تفاصيل الرد {String(selectedResponse.referenceNumber)}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 text-xs sm:grid-cols-2">
              <p><b>مصدر الاستقبال:</b> رابط استقبال — {String(selectedResponse.type || "—")}</p>
              <p><b>تاريخ ووقت الاستلام:</b> {selectedResponse.receivedAt ? new Date(String(selectedResponse.receivedAt)).toLocaleString("ar-SA") : "—"}</p>
              <p><b>مقدم الرد:</b> {maskPii ? "محمي وفق الصلاحية" : selectedResponse.anonymous ? "مجهول" : `${String(selectedResponse.submitterName || "—")}${selectedResponse.submitterEmail ? ` · ${String(selectedResponse.submitterEmail)}` : ""}`}</p>
              <p><b>الجهة:</b> {maskPii ? "محمي وفق الصلاحية" : String(selectedResponse.submitterOrg || "—")}</p>
              <p><b>الخدمة/الحل المرتبط:</b> {String(selectedResponse.relatedServiceName || "—")}</p>
              <p><b>الحالة:</b> {String(selectedResponse.status)}</p>
            </div>
            <div><p className="text-xs font-bold">العنوان</p><p className="mt-1 text-sm">{String(selectedResponse.title)}</p></div>
            <div><p className="text-xs font-bold">الوصف</p><p className="mt-1 whitespace-pre-line text-sm">{String(selectedResponse.description)}</p></div>
            {Object.keys((selectedResponse.customAnswers as Row) ?? {}).length ? (
              <div><p className="text-xs font-bold">إجابات إضافية</p>{Object.entries(selectedResponse.customAnswers as Record<string, string>).map(([k, v]) => <p key={k} className="mt-1 text-xs">{k}: {v}</p>)}</div>
            ) : null}
            {arr(selectedResponse.attachments).length ? (
              <div>
                <p className="text-xs font-bold">المرفقات</p>
                {arr(selectedResponse.attachments).map((att, index) => preview ? (
                  <p key={index} className="mt-1 flex items-center gap-1.5 text-xs text-muted"><Download className="h-3.5 w-3.5" />{String(att.fileName)} (معاينة — بلا ملف فعلي)</p>
                ) : (
                  <a key={index} href={`/api/intake-responses/${assignmentId}/${linkId}/${String(selectedResponse.id)}/${index}/download`} className="mt-1 flex items-center gap-1.5 text-xs text-primary"><Download className="h-3.5 w-3.5" />{String(att.fileName)}</a>
                ))}
              </div>
            ) : null}
            {canEdit ? (
              <div className="grid gap-3 rounded-xl border p-3 sm:grid-cols-2">
                <label className="text-xs font-semibold">إسناد مالك<select value={String(selectedResponse.ownerUserId || "")} onChange={(e) => assignOwner(String(selectedResponse.id), e.target.value)} className="mt-1 h-9 w-full rounded-lg border bg-transparent px-3 text-xs"><option value="">غير مسند</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></label>
                <label className="text-xs font-semibold">الحالة<select value={String(selectedResponse.status)} onChange={(e) => updateResponseStatus(String(selectedResponse.id), e.target.value)} className="mt-1 h-9 w-full rounded-lg border bg-transparent px-3 text-xs">{INTAKE_RESPONSE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
                <div className="sm:col-span-2"><Text label="ملاحظات داخلية" value={selectedResponse.notes} area onChange={(v) => updateResponseNotes(String(selectedResponse.id), v)} /></div>
              </div>
            ) : null}
            <div>
              <p className="mb-2 text-xs font-bold">مهام المتابعة</p>
              <div className="space-y-2">
                {arr(selectedResponse.tasks).map((task) => (
                  <div key={String(task.id)} className="grid gap-2 rounded-lg border p-2 text-xs sm:grid-cols-4">
                    <span className="sm:col-span-2 font-semibold">{String(task.title)} — {String(task.assignee || "—")}</span>
                    <span>{task.dueDate ? new Date(String(task.dueDate)).toLocaleDateString("ar-SA") : "—"}</span>
                    {canEdit ? <select value={String(task.status)} onChange={(e) => updateFollowUpTask(String(selectedResponse.id), String(task.id), { status: e.target.value })} className="h-8 rounded-lg border bg-transparent px-2 text-xs">{Object.keys(TASK_STATUS_LABELS).map((s) => <option key={s} value={s}>{TASK_STATUS_LABELS[s]}</option>)}</select> : <span>{TASK_STATUS_LABELS[String(task.status)] ?? String(task.status)}</span>}
                  </div>
                ))}
                {!arr(selectedResponse.tasks).length ? <p className="text-xs text-muted">لا توجد مهمة متابعة مسندة بعد.</p> : null}
              </div>
              {canEdit ? (
                <div className="mt-3 flex flex-wrap items-end gap-2 rounded-xl border p-3">
                  <label className="text-xs font-semibold">عنوان المهمة<input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} className="mt-1 h-9 w-52 rounded-lg border bg-transparent px-2 text-xs" /></label>
                  <label className="text-xs font-semibold">المسؤول<select value={taskUser} onChange={(e) => setTaskUser(e.target.value)} className="mt-1 h-9 w-40 rounded-lg border bg-transparent px-2 text-xs"><option value="">اختر</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></label>
                  <label className="text-xs font-semibold">الموعد<input type="date" value={taskDue} onChange={(e) => setTaskDue(e.target.value)} className="mt-1 h-9 rounded-lg border bg-transparent px-2 text-xs" /></label>
                  <Button size="sm" onClick={() => { addFollowUpTask(String(selectedResponse.id), taskTitle, taskUser, taskDue); setTaskTitle(""); setTaskUser(""); setTaskDue(""); }} disabled={!taskTitle.trim() || !taskUser}><Plus className="h-4 w-4" />إسناد متابعة</Button>
                </div>
              ) : null}
            </div>
            {canEdit && selectedResponse.status !== "مغلق" ? <Button size="sm" variant="outline" onClick={() => closeResponse(String(selectedResponse.id))}>إغلاق الرد</Button> : null}
            <div>
              <p className="mb-2 text-xs font-bold">السجل الزمني للرد</p>
              {arr(selectedResponse.history).map((row, index) => <p key={index} className="text-[11px] text-muted">{row.date ? new Date(String(row.date)).toLocaleString("ar-SA") : "—"} · {String(row.action)}</p>)}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function EvidenceReadinessTab({ current, responses, evidence }: { current: Row; responses: Row[]; evidence: { id: string; classification: string | null; reviewStatus: string; relatedRecord?: string | null }[] }) {
  const relatedEvidence = evidence.filter((item) => item.relatedRecord === current.name);
  const checks: [string, boolean][] = [
    ["بيانات الرابط موثّقة (الاسم والغرض والوصف)", Boolean(String(current.name || "").trim() && String(current.purpose || "").trim() && String(current.participantDescription || "").trim())],
    ["الرابط نشط ويستقبل ردودًا", isIntakeLinkAcceptingResponses(current)],
    ["استُلم رد واحد على الأقل يثبت عمل الآلية فعليًا", responses.length > 0],
    ["دليل رسمي مرفوع", relatedEvidence.length > 0],
    ["دليل رسمي معتمد", relatedEvidence.some((item) => item.reviewStatus === "APPROVED")],
  ];
  return (
    <Card>
      <CardHeader><CardTitle>الأدلة والجاهزية</CardTitle><p className="mt-1 text-xs text-muted">التوثيق داخل المنصة لا يمثل اعتمادًا رسميًا من هيئة الحكومة الرقمية — الجاهزية توضيح للفجوات الفعلية فقط.</p></CardHeader>
      <CardContent className="space-y-2">
        {checks.map(([label, done]) => <p key={label} className="flex items-center gap-2 rounded-lg border p-3 text-sm">{done ? <CheckCircle2 className="h-4 w-4 text-success" /> : <AlertTriangle className="h-4 w-4 text-warning" />}{label}<Badge className="mr-auto" variant={done ? "success" : "warning"}>{done ? "مكتمل" : "ناقص"}</Badge></p>)}
        {relatedEvidence.map((item) => <div key={item.id} className="rounded-lg border p-3 text-xs"><b>{item.classification}</b> · {item.reviewStatus}</div>)}
      </CardContent>
    </Card>
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
