"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, GitBranch, Plus, Settings2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { WorkspaceData } from "../workspace-status";

type Row = Record<string, unknown>;
type EvidenceRow = { id: string; classification: string | null; reviewStatus: string; relatedRecord?: string | null };
type CommitteeOption = { id: string; name: string };

const tabs = ["نظرة عامة", "العمليات والإجراءات", "السياسات والوثائق", "المراجعات", "القرارات", "الإجراءات التصحيحية", "تقارير الأداء", "المهام", "السجل"] as const;
const TASK_STATUS_LABELS: Record<string, string> = { NOT_STARTED: "لم تبدأ", IN_PROGRESS: "قيد التنفيذ", WAITING: "بانتظار طرف آخر", COMPLETED: "مكتملة", OVERDUE: "متأخرة", CANCELLED: "ملغاة" };
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
        <textarea disabled={!editable} value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} className="mt-1 min-h-16 w-full rounded-lg border bg-transparent p-3 text-xs disabled:cursor-not-allowed disabled:opacity-70" />
      ) : (
        <input disabled={!editable} type={type} value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} className="mt-1 h-9 w-full rounded-lg border bg-transparent px-3 text-xs disabled:cursor-not-allowed disabled:opacity-70" />
      )}
    </label>
  );
}
function Select({ label, value, values, labels, onChange, required = false }: { label: string; value: unknown; values: string[]; labels?: Record<string, string>; onChange: (value: string) => void; required?: boolean }) {
  const editable = useContext(EditContext);
  return (
    <label className="text-xs font-semibold">
      {label}
      {required ? <span className="text-danger"> *</span> : null}
      <select disabled={!editable} value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} className="mt-1 h-9 w-full rounded-lg border bg-transparent px-3 text-xs disabled:cursor-not-allowed disabled:opacity-70">
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
function CommitteeMultiSelect({ label, value, options, onChange }: { label: string; value: unknown; options: CommitteeOption[]; onChange: (value: string[]) => void }) {
  const editable = useContext(EditContext);
  const selected = Array.isArray(value) ? (value as string[]) : [];
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id]);
  return (
    <div className="text-xs font-semibold md:col-span-2">
      {label}
      <span className="text-danger"> *</span>
      <div className="mt-1 flex flex-wrap gap-2 rounded-lg border p-2">
        {options.length ? (
          options.map((option) => (
            <label key={option.id} className="flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-normal">
              <input disabled={!editable} type="checkbox" checked={selected.includes(option.id)} onChange={() => toggle(option.id)} />
              {option.name}
            </label>
          ))
        ) : (
          <p className="text-[11px] font-normal text-muted">لا توجد وحدات/لجان في المتطلب 01 بعد — أضِف واحدة أولًا من 5.23.3.1.</p>
        )}
      </div>
      {selected.length ? <p className="mt-1 text-[11px] font-normal text-muted">المختارة: {committeeNames(selected, options).join("، ")}</p> : null}
    </div>
  );
}
function CommitteeSelect({ label, value, options, onChange }: { label: string; value: unknown; options: CommitteeOption[]; onChange: (value: string) => void }) {
  const editable = useContext(EditContext);
  return (
    <label className="text-xs font-semibold">
      {label}
      <span className="text-danger"> *</span>
      <select disabled={!editable} value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} className="mt-1 h-9 w-full rounded-lg border bg-transparent px-3 text-xs disabled:cursor-not-allowed disabled:opacity-70">
        <option value="">اختر اللجنة/الوحدة المشرفة</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    </label>
  );
}
function committeeNames(ids: unknown, options: CommitteeOption[]) {
  const list = Array.isArray(ids) ? (ids as string[]) : ids ? [String(ids)] : [];
  return list.map((id) => options.find((option) => option.id === id)?.name ?? id).filter(Boolean);
}

export function GovernanceOperationsWorkspace({
  data,
  canEdit,
  onChange,
  personaKey = "",
  users = [],
  evidence = [],
  referenceData = {},
}: {
  data: WorkspaceData;
  canEdit: boolean;
  onChange: (data: WorkspaceData) => void;
  personaKey?: string;
  users?: { id: string; name: string; email: string }[];
  evidence?: EvidenceRow[];
  referenceData?: WorkspaceData;
}) {
  const [tab, setTab] = useState<(typeof tabs)[number]>(tabs[0]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    if (hash.startsWith("#corrective-")) setTab("الإجراءات التصحيحية");
    else if (hash.startsWith("#task-")) setTab("المهام");
  }, []);
  const committeeOptions = useMemo<CommitteeOption[]>(() => arr(referenceData.structures).map((row) => ({ id: String(row.committeeId ?? row.id ?? ""), name: String(row.name ?? "") })).filter((row) => row.id && row.name), [referenceData.structures]);
  const initiativeOptions = useMemo(() => arr(referenceData.initiatives).map((row) => ({ id: String(row.id ?? row.name ?? ""), name: String(row.name ?? ""), owner: String(row.owner ?? ""), status: String(row.status ?? "") })).filter((row) => row.name), [referenceData.initiatives]);

  const processes = arr(data.processes);
  const policies = arr(data.policies);
  const reviews = arr(data.reviews);
  const decisions = arr(data.decisions);
  const correctiveActions = arr(data.correctiveActions);
  const performanceReports = arr(data.performanceReports);
  const tasks = arr(data.tasks);

  const availableTabs = personaKey === "viewer" || personaKey === "partner" ? tabs.filter((item) => item !== "السجل") : tabs;

  const update = (key: string, rows: Row[]) => onChange({ ...data, [key]: rows });
  const pushLog = (action: string) => onChange({ ...data, log: [{ date: new Date().toISOString(), action }, ...arr(data.log)] });
  const addRow = (key: string, row: Row, logMessage: string) => {
    update(key, [...arr(data[key]), row]);
    pushLog(logMessage);
  };
  const patchRow = (key: string, index: number, patch: Row) => update(key, arr(data[key]).map((row, i) => (i === index ? { ...row, ...patch } : row)));
  const delegate = (recordType: string, recordLabel: string, committeeId?: string) => {
    const task: Row = { id: newId("task"), title: `متابعة: ${recordLabel}`, description: "", relatedRecordType: recordType, relatedRecordLabel: recordLabel, committeeId: committeeId ?? "", assignedUserId: "", assignee: "", priority: "MEDIUM", assignedAt: new Date().toISOString().slice(0, 10), dueDate: "", status: "NOT_STARTED", nextAction: "فتح المهمة" };
    addRow("tasks", task, `إسناد متابعة لسجل: ${recordLabel}`);
    setTab("المهام");
  };

  const approvedPolicies = policies.filter((row) => row.approvalStatus === "معتمد").length;
  const openCorrective = correctiveActions.filter((row) => !["مكتمل", "مغلق"].includes(String(row.status)));
  const openDecisions = decisions.filter((row) => !["منفَّذ", "ملغى"].includes(String(row.status)));
  const openTasks = tasks.filter((row) => !["COMPLETED", "CANCELLED"].includes(String(row.status)));
  const hasApprovedActivationEvidence = evidence.some((item) => item.classification === "COMMITTEE_ACTIVATION_DOCUMENTS" && item.reviewStatus === "APPROVED");

  const gaps = [
    !processes.length ? "لا توجد عمليات أو إجراءات موثّقة بعد" : null,
    processes.some((row) => !(Array.isArray(row.committeeIds) && (row.committeeIds as unknown[]).length)) ? "توجد عملية/إجراء غير مرتبط بأي وحدة/لجنة من المتطلب 01" : null,
    !approvedPolicies ? "لا توجد سياسة أو إجراء أو دليل عمل معتمد بعد" : null,
    openCorrective.length ? `يوجد ${openCorrective.length} إجراء تصحيحي مفتوح` : null,
    !hasApprovedActivationEvidence ? "لم يُعتمد بعد دليل يثبت تفعيل الوحدة/اللجنة" : null,
    !reviews.length ? "لا توجد مراجعة حوكمة موثّقة بعد" : null,
  ].filter(Boolean) as string[];
  const nextAction = gaps[0] ?? (openTasks.length ? `متابعة ${openTasks.length} مهمة مفتوحة` : "لا يوجد إجراء عاجل — تابع مراجعة الأدلة والاعتماد");

  return (
    <EditContext.Provider value={canEdit}>
      <Card className="border-primary/20">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Settings2 className="h-4 w-4" /> تفعيل الحوكمة — العمليات والقرارات
              </CardTitle>
              <p className="mt-1 text-xs text-muted">كل سجل هنا يجب أن يرتبط بوحدة/لجنة واحدة أو أكثر من المتطلب 5.23.3.1 — لا تُنشأ لجان جديدة من هذه المساحة.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="primary">{processes.length} عملية/إجراء</Badge>
              <Badge variant={openCorrective.length ? "warning" : "success"}>{openCorrective.length} إجراء تصحيحي مفتوح</Badge>
            </div>
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
              <Overview processes={processes} policies={policies} reviews={reviews} decisions={decisions} correctiveActions={correctiveActions} performanceReports={performanceReports} committeeOptions={committeeOptions} approvedPolicies={approvedPolicies} openCorrective={openCorrective.length} openDecisions={openDecisions.length} gaps={gaps} nextAction={nextAction} />
            ) : tab === "العمليات والإجراءات" ? (
              <Processes rows={processes} committeeOptions={committeeOptions} canEdit={canEdit} add={() => addRow("processes", { id: newId("process"), name: "", type: "عملية", purpose: "", description: "", owner: "", department: "", committeeIds: [], stakeholders: "", inputs: "", steps: "", outputs: "", approvalStatus: "مسودة", effectiveDate: "", version: "1.0", notes: "" }, "إضافة عملية/إجراء جديد")} update={(index, patch) => patchRow("processes", index, patch)} delegate={delegate} />
            ) : tab === "السياسات والوثائق" ? (
              <Policies rows={policies} committeeOptions={committeeOptions} processOptions={processes} canEdit={canEdit} add={() => addRow("policies", { id: newId("policy"), name: "", recordType: "سياسة", owner: "", version: "1.0", effectiveDate: "", reviewDate: "", approvalStatus: "مسودة", committeeIds: [], relatedProcessName: "", notes: "" }, "إضافة سياسة/وثيقة جديدة")} update={(index, patch) => patchRow("policies", index, patch)} />
            ) : tab === "المراجعات" ? (
              <Reviews rows={reviews} committeeOptions={committeeOptions} initiativeOptions={initiativeOptions} canEdit={canEdit} add={() => addRow("reviews", { id: newId("review"), subject: "", type: "مراجعة دورية", relatedRecord: "", relatedInitiative: "", committeeIds: [], reviewDate: "", requestedBy: "", reviewers: "", decision: "", notes: "", nextAction: "" }, "توثيق مراجعة حوكمة جديدة")} update={(index, patch) => patchRow("reviews", index, patch)} delegate={delegate} />
            ) : tab === "القرارات" ? (
              <Decisions rows={decisions} committeeOptions={committeeOptions} initiativeOptions={initiativeOptions} canEdit={canEdit} add={() => addRow("decisions", { id: newId("decision"), referenceNumber: "", subject: "", committeeIds: [], decisionDate: "", decisionText: "", responsible: "", dueDate: "", status: "مفتوح", relatedInitiative: "", notes: "" }, "تسجيل قرار جديد")} update={(index, patch) => patchRow("decisions", index, patch)} delegate={delegate} />
            ) : tab === "الإجراءات التصحيحية" ? (
              <CorrectiveActions rows={correctiveActions} committeeOptions={committeeOptions} users={users} canEdit={canEdit} add={() => addRow("correctiveActions", { id: newId("corrective"), reason: "", action: "", responsible: "", assignedUserId: "", committeeId: "", assignedAt: new Date().toISOString().slice(0, 10), dueDate: "", status: "مفتوح", result: "" }, "فتح إجراء تصحيحي جديد")} update={(index, patch) => patchRow("correctiveActions", index, patch)} />
            ) : tab === "تقارير الأداء" ? (
              <PerformanceReports rows={performanceReports} committeeOptions={committeeOptions} canEdit={canEdit} add={() => addRow("performanceReports", { id: newId("report"), period: "", entity: "", committeeIds: [], scope: "", indicators: "", summary: "", resultingDecisions: "", correctiveActionsNote: "", status: "مسودة" }, "إعداد تقرير أداء جديد")} update={(index, patch) => patchRow("performanceReports", index, patch)} delegate={delegate} />
            ) : tab === "المهام" ? (
              <Tasks rows={tasks} users={users} committeeOptions={committeeOptions} canEdit={canEdit} add={() => addRow("tasks", { id: newId("task"), title: "مهمة متابعة جديدة", description: "", relatedRecordType: "", relatedRecordLabel: "", committeeId: "", assignedUserId: "", assignee: "", priority: "MEDIUM", assignedAt: new Date().toISOString().slice(0, 10), dueDate: "", status: "NOT_STARTED", nextAction: "فتح المهمة" }, "إضافة مهمة متابعة")} update={(index, patch) => { patchRow("tasks", index, patch); if (patch.status === "COMPLETED") pushLog(`إكمال مهمة: ${String(tasks[index]?.title ?? "")}`); }} />
            ) : (
              <Log rows={arr(data.log)} />
            )}
          </div>
        </CardContent>
      </Card>
    </EditContext.Provider>
  );
}

function Overview({ processes, policies, reviews, decisions, correctiveActions, performanceReports, committeeOptions, approvedPolicies, openCorrective, openDecisions, gaps, nextAction }: { processes: Row[]; policies: Row[]; reviews: Row[]; decisions: Row[]; correctiveActions: Row[]; performanceReports: Row[]; committeeOptions: CommitteeOption[]; approvedPolicies: number; openCorrective: number; openDecisions: number; gaps: string[]; nextAction: string }) {
  const rows: [string, string][] = [
    ["ما العمليات/الإجراءات المعتمدة؟", `${processes.filter((row) => row.approvalStatus === "معتمد").length} من أصل ${processes.length} معتمدة`],
    ["ما حالة السياسات والوثائق؟", `${approvedPolicies} من أصل ${policies.length} معتمدة`],
    ["ما نشاط الحوكمة الأخير؟", `${reviews.length} مراجعة، ${decisions.length} قرار، ${performanceReports.length} تقرير أداء`],
    ["هل يوجد عمل معلّق؟", openCorrective || openDecisions ? `${openCorrective} إجراء تصحيحي مفتوح، ${openDecisions} قرار قيد التنفيذ` : "لا يوجد عمل معلّق ظاهر"],
    ["ما الناقص؟", gaps.length ? gaps.join("، ") : "لا يوجد نقص ظاهر"],
    ["ما الإجراء التالي؟", nextAction],
  ];
  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label} className="rounded-xl border p-4">
            <p className="text-xs font-semibold text-muted">{label}</p>
            <p className="mt-1 text-sm leading-6">{value}</p>
          </div>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <GitBranch className="h-4 w-4" /> الترابط: من اللجنة إلى النتيجة
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-xs">
            <thead>
              <tr className="border-b text-muted">{["اللجنة/الوحدة", "عمليات", "مراجعات", "قرارات", "إجراءات تصحيحية"].map((label) => <th key={label} className="p-2 text-start">{label}</th>)}</tr>
            </thead>
            <tbody>
              {committeeOptions.map((committee) => (
                <tr key={committee.id} className="border-b">
                  <td className="p-2 font-semibold">{committee.name}</td>
                  <td className="p-2">{processes.filter((row) => Array.isArray(row.committeeIds) && (row.committeeIds as string[]).includes(committee.id)).length}</td>
                  <td className="p-2">{reviews.filter((row) => Array.isArray(row.committeeIds) && (row.committeeIds as string[]).includes(committee.id)).length}</td>
                  <td className="p-2">{decisions.filter((row) => Array.isArray(row.committeeIds) && (row.committeeIds as string[]).includes(committee.id)).length}</td>
                  <td className="p-2">{correctiveActions.filter((row) => row.committeeId === committee.id).length}</td>
                </tr>
              ))}
              {!committeeOptions.length ? <tr><td colSpan={5} className="p-4 text-center text-muted">لا توجد وحدات/لجان من المتطلب 01 بعد.</td></tr> : null}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function DelegateButton({ onClick }: { onClick: () => void }) {
  const editable = useContext(EditContext);
  if (!editable) return null;
  return (
    <Button type="button" size="sm" variant="outline" onClick={onClick}>
      <Plus className="h-3.5 w-3.5" /> إسناد متابعة
    </Button>
  );
}

function Processes({ rows, committeeOptions, canEdit, add, update, delegate }: { rows: Row[]; committeeOptions: CommitteeOption[]; canEdit: boolean; add: () => void; update: (index: number, patch: Row) => void; delegate: (type: string, label: string, committeeId?: string) => void }) {
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-bold">العمليات والإجراءات المعتمدة</h3>
          <p className="text-xs text-muted">وثّق كل عملية أو إجراء تشغّله الوحدة/اللجنة، واربطه بواحدة أو أكثر من لجان المتطلب 01.</p>
        </div>
        {canEdit ? <Button size="sm" onClick={add}><Plus className="h-4 w-4" />إضافة عملية / إجراء</Button> : null}
      </div>
      <div className="mt-4 space-y-3">
        {rows.map((row, index) => (
          <div key={String(row.id)} className="rounded-xl border p-4">
            <div className="grid gap-3 md:grid-cols-3">
              <Text label="الاسم" value={row.name} required onChange={(v) => update(index, { name: v })} />
              <Select label="النوع" value={row.type} values={["عملية", "إجراء"]} required onChange={(v) => update(index, { type: v })} />
              <Select label="حالة الاعتماد" value={row.approvalStatus} values={["مسودة", "قيد المراجعة", "معتمد"]} required onChange={(v) => update(index, { approvalStatus: v })} />
              <Text label="المالك" value={row.owner} required onChange={(v) => update(index, { owner: v })} />
              <Text label="الإدارة" value={row.department} required onChange={(v) => update(index, { department: v })} />
              <Text label="الإصدار" value={row.version} onChange={(v) => update(index, { version: v })} />
              <Text label="تاريخ السريان" type="date" value={row.effectiveDate} onChange={(v) => update(index, { effectiveDate: v })} />
              <Text label="الأطراف ذات العلاقة" value={row.stakeholders} onChange={(v) => update(index, { stakeholders: v })} />
              <CommitteeMultiSelect label="اللجان/الوحدات المعنية" value={row.committeeIds} options={committeeOptions} onChange={(v) => update(index, { committeeIds: v })} />
              <div className="md:col-span-3"><Text label="الغرض" value={row.purpose} area required onChange={(v) => update(index, { purpose: v })} /></div>
              <div className="md:col-span-3"><Text label="الوصف" value={row.description} area required onChange={(v) => update(index, { description: v })} /></div>
              <Text label="المدخلات" value={row.inputs} area onChange={(v) => update(index, { inputs: v })} />
              <Text label="الخطوات" value={row.steps} area onChange={(v) => update(index, { steps: v })} />
              <Text label="المخرجات" value={row.outputs} area onChange={(v) => update(index, { outputs: v })} />
              <div className="md:col-span-3"><Text label="ملاحظات" value={row.notes} area onChange={(v) => update(index, { notes: v })} /></div>
            </div>
            <div className="mt-3 flex justify-end"><DelegateButton onClick={() => delegate("عملية/إجراء", String(row.name || "عملية بلا اسم"), Array.isArray(row.committeeIds) ? (row.committeeIds as string[])[0] : undefined)} /></div>
          </div>
        ))}
        {!rows.length ? <p className="rounded-lg border border-dashed p-6 text-center text-xs text-muted">لا توجد عمليات أو إجراءات موثّقة بعد.</p> : null}
      </div>
    </div>
  );
}

function Policies({ rows, committeeOptions, processOptions, canEdit, add, update }: { rows: Row[]; committeeOptions: CommitteeOption[]; processOptions: Row[]; canEdit: boolean; add: () => void; update: (index: number, patch: Row) => void }) {
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-bold">السياسات والوثائق الداعمة</h3>
          <p className="text-xs text-muted">سياسة، إجراء، دليل عمل، نموذج، أو إطار — الملف الفعلي يُرفع من لوحة مستندات الإثبات أسفل الصفحة، لا يُكرَّر هنا.</p>
        </div>
        {canEdit ? <Button size="sm" onClick={add}><Plus className="h-4 w-4" />إضافة سياسة / وثيقة</Button> : null}
      </div>
      <div className="mt-4 space-y-3">
        {rows.map((row, index) => (
          <div key={String(row.id)} className="grid gap-3 rounded-xl border p-4 md:grid-cols-3">
            <Text label="الاسم" value={row.name} onChange={(v) => update(index, { name: v })} />
            <Select label="النوع" value={row.recordType} values={["سياسة", "إجراء", "دليل عمل", "نموذج", "إطار"]} onChange={(v) => update(index, { recordType: v })} />
            <Select label="حالة الاعتماد" value={row.approvalStatus} values={["مسودة", "قيد المراجعة", "معتمد"]} onChange={(v) => update(index, { approvalStatus: v })} />
            <Text label="المالك" value={row.owner} onChange={(v) => update(index, { owner: v })} />
            <Text label="الإصدار" value={row.version} onChange={(v) => update(index, { version: v })} />
            <Text label="تاريخ السريان" type="date" value={row.effectiveDate} onChange={(v) => update(index, { effectiveDate: v })} />
            <Text label="تاريخ المراجعة القادمة" type="date" value={row.reviewDate} onChange={(v) => update(index, { reviewDate: v })} />
            <label className="text-xs font-semibold md:col-span-2">
              العملية/الإجراء المرتبط (اختياري)
              <select disabled={!canEdit} value={String(row.relatedProcessName ?? "")} onChange={(event) => update(index, { relatedProcessName: event.target.value })} className="mt-1 h-9 w-full rounded-lg border bg-transparent px-3 text-xs">
                <option value="">بلا ربط</option>
                {processOptions.map((process) => (
                  <option key={String(process.id)} value={String(process.name)}>{String(process.name)}</option>
                ))}
              </select>
            </label>
            <CommitteeMultiSelect label="اللجان/الوحدات المعنية" value={row.committeeIds} options={committeeOptions} onChange={(v) => update(index, { committeeIds: v })} />
            <div className="md:col-span-3"><Text label="ملاحظات" value={row.notes} area onChange={(v) => update(index, { notes: v })} /></div>
          </div>
        ))}
        {!rows.length ? <p className="rounded-lg border border-dashed p-6 text-center text-xs text-muted">لا توجد سياسات أو وثائق مسجَّلة بعد.</p> : null}
      </div>
    </div>
  );
}

function InitiativeCard({ id, options }: { id: unknown; options: { id: string; name: string; owner: string; status: string }[] }) {
  const found = options.find((item) => item.id === id || item.name === id);
  if (!id || !found) return null;
  return (
    <div className="mt-2 rounded-lg bg-primary-50 p-2 text-[11px]">
      <b>بطاقة المبادرة المرتبطة:</b> {found.name} · {found.owner || "بلا مالك محدد"} · {found.status || "بلا حالة"}
    </div>
  );
}

function Reviews({ rows, committeeOptions, initiativeOptions, canEdit, add, update, delegate }: { rows: Row[]; committeeOptions: CommitteeOption[]; initiativeOptions: { id: string; name: string; owner: string; status: string }[]; canEdit: boolean; add: () => void; update: (index: number, patch: Row) => void; delegate: (type: string, label: string, committeeId?: string) => void }) {
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-bold">مراجعات الحوكمة</h3>
          <p className="text-xs text-muted">وثّق مراجعة أعمال الابتكار (مبادرة، مشروع، تقرير) قبل أو بعد التنفيذ. اربط المبادرة القائمة بدل إعادة إنشائها.</p>
        </div>
        {canEdit ? <Button size="sm" onClick={add}><Plus className="h-4 w-4" />توثيق مراجعة</Button> : null}
      </div>
      <div className="mt-4 space-y-3">
        {rows.map((row, index) => (
          <div key={String(row.id)} className="rounded-xl border p-4">
            <div className="grid gap-3 md:grid-cols-3">
              <Text label="الموضوع" value={row.subject} onChange={(v) => update(index, { subject: v })} />
              <Text label="النوع" value={row.type} onChange={(v) => update(index, { type: v })} />
              <Text label="تاريخ العرض" type="date" value={row.reviewDate} onChange={(v) => update(index, { reviewDate: v })} />
              <Text label="السجل المرتبط (نصي)" value={row.relatedRecord} onChange={(v) => update(index, { relatedRecord: v })} />
              <label className="text-xs font-semibold">
                المبادرة المرتبطة (اختياري)
                <select disabled={!canEdit} value={String(row.relatedInitiative ?? "")} onChange={(event) => update(index, { relatedInitiative: event.target.value })} className="mt-1 h-9 w-full rounded-lg border bg-transparent px-3 text-xs">
                  <option value="">بلا ربط</option>
                  {initiativeOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </label>
              <Text label="مقدم الطلب" value={row.requestedBy} onChange={(v) => update(index, { requestedBy: v })} />
              <CommitteeMultiSelect label="اللجنة/اللجان" value={row.committeeIds} options={committeeOptions} onChange={(v) => update(index, { committeeIds: v })} />
              <Text label="المراجعون" value={row.reviewers} area onChange={(v) => update(index, { reviewers: v })} />
              <Text label="القرار" value={row.decision} area onChange={(v) => update(index, { decision: v })} />
              <Text label="الإجراء التالي" value={row.nextAction} onChange={(v) => update(index, { nextAction: v })} />
              <div className="md:col-span-3"><Text label="الملاحظات (تشمل وصف المرفقات)" value={row.notes} area onChange={(v) => update(index, { notes: v })} /></div>
            </div>
            <InitiativeCard id={row.relatedInitiative} options={initiativeOptions} />
            <div className="mt-3 flex justify-end"><DelegateButton onClick={() => delegate("مراجعة", String(row.subject || "مراجعة بلا موضوع"), Array.isArray(row.committeeIds) ? (row.committeeIds as string[])[0] : undefined)} /></div>
          </div>
        ))}
        {!rows.length ? <p className="rounded-lg border border-dashed p-6 text-center text-xs text-muted">لا توجد مراجعات موثّقة بعد.</p> : null}
      </div>
    </div>
  );
}

function Decisions({ rows, committeeOptions, initiativeOptions, canEdit, add, update, delegate }: { rows: Row[]; committeeOptions: CommitteeOption[]; initiativeOptions: { id: string; name: string; owner: string; status: string }[]; canEdit: boolean; add: () => void; update: (index: number, patch: Row) => void; delegate: (type: string, label: string, committeeId?: string) => void }) {
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-bold">سجل القرارات</h3>
          <p className="text-xs text-muted">إن لم يوجد رقم/مرجع رسمي للقرار، اترك الحقل فارغًا — لا تُختلق أرقام.</p>
        </div>
        {canEdit ? <Button size="sm" onClick={add}><Plus className="h-4 w-4" />تسجيل قرار</Button> : null}
      </div>
      <div className="mt-4 space-y-3">
        {rows.map((row, index) => (
          <div key={String(row.id)} className="rounded-xl border p-4">
            <div className="grid gap-3 md:grid-cols-3">
              <Text label="رقم/مرجع القرار (إن وجد)" value={row.referenceNumber} onChange={(v) => update(index, { referenceNumber: v })} />
              <Text label="الموضوع" value={row.subject} onChange={(v) => update(index, { subject: v })} />
              <Text label="تاريخ القرار" type="date" value={row.decisionDate} onChange={(v) => update(index, { decisionDate: v })} />
              <Text label="المسؤول عن التنفيذ" value={row.responsible} onChange={(v) => update(index, { responsible: v })} />
              <Text label="الموعد" type="date" value={row.dueDate} onChange={(v) => update(index, { dueDate: v })} />
              <Select label="الحالة" value={row.status} values={["مفتوح", "قيد التنفيذ", "منفَّذ", "ملغى"]} onChange={(v) => update(index, { status: v })} />
              <CommitteeMultiSelect label="اللجنة أو اللجان" value={row.committeeIds} options={committeeOptions} onChange={(v) => update(index, { committeeIds: v })} />
              <label className="text-xs font-semibold">
                المبادرة/السجل المرتبط (اختياري)
                <select disabled={!canEdit} value={String(row.relatedInitiative ?? "")} onChange={(event) => update(index, { relatedInitiative: event.target.value })} className="mt-1 h-9 w-full rounded-lg border bg-transparent px-3 text-xs">
                  <option value="">بلا ربط</option>
                  {initiativeOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </label>
              <div className="md:col-span-3"><Text label="القرار" value={row.decisionText} area onChange={(v) => update(index, { decisionText: v })} /></div>
              <div className="md:col-span-3"><Text label="ملاحظات ومستند داعم (وصف)" value={row.notes} area onChange={(v) => update(index, { notes: v })} /></div>
            </div>
            <InitiativeCard id={row.relatedInitiative} options={initiativeOptions} />
            <div className="mt-3 flex justify-end"><DelegateButton onClick={() => delegate("قرار", String(row.subject || "قرار بلا موضوع"), Array.isArray(row.committeeIds) ? (row.committeeIds as string[])[0] : undefined)} /></div>
          </div>
        ))}
        {!rows.length ? <p className="rounded-lg border border-dashed p-6 text-center text-xs text-muted">لا توجد قرارات مسجَّلة بعد.</p> : null}
      </div>
    </div>
  );
}

function CorrectiveActions({ rows, committeeOptions, users, canEdit, add, update }: { rows: Row[]; committeeOptions: CommitteeOption[]; users: { id: string; name: string; email: string }[]; canEdit: boolean; add: () => void; update: (index: number, patch: Row) => void }) {
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-bold">الإجراءات التصحيحية</h3>
          <p className="text-xs text-muted">ناتجة عن قرار أو مراجعة أداء. المُسند لمستخدم منصة يظهر في «مهامي» بعد الحفظ.</p>
        </div>
        {canEdit ? <Button size="sm" onClick={add}><Plus className="h-4 w-4" />فتح إجراء تصحيحي</Button> : null}
      </div>
      <div className="mt-4 space-y-3">
        {rows.map((row, index) => (
          <div key={String(row.id)} id={`corrective-${String(row.id)}`} className="grid gap-3 rounded-xl border p-4 md:grid-cols-3">
            <div className="md:col-span-3"><Text label="السبب" value={row.reason} area onChange={(v) => update(index, { reason: v })} /></div>
            <div className="md:col-span-3"><Text label="الإجراء" value={row.action} area onChange={(v) => update(index, { action: v })} /></div>
            <Text label="المسؤول (نصي)" value={row.responsible} onChange={(v) => update(index, { responsible: v })} />
            <label className="text-xs font-semibold">
              المسؤول (مستخدم المنصة)
              <select disabled={!canEdit} value={String(row.assignedUserId || "")} onChange={(event) => { const user = users.find((item) => item.id === event.target.value); update(index, { assignedUserId: event.target.value, assignee: user?.name || row.assignee }); }} className="mt-1 h-9 w-full rounded-lg border bg-transparent px-3 text-xs">
                <option value="">مسؤول نصي فقط</option>
                {users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
              </select>
            </label>
            <CommitteeSelect label="اللجنة المشرفة" value={row.committeeId} options={committeeOptions} onChange={(v) => update(index, { committeeId: v })} />
            <Text label="تاريخ الإسناد" type="date" value={row.assignedAt} onChange={(v) => update(index, { assignedAt: v })} />
            <Text label="الموعد النهائي" type="date" value={row.dueDate} onChange={(v) => update(index, { dueDate: v })} />
            <Select label="الحالة" value={row.status} values={["مفتوح", "قيد التنفيذ", "مكتمل", "مغلق"]} onChange={(v) => update(index, { status: v, completedAt: v === "مكتمل" ? new Date().toISOString() : null })} />
            <div className="md:col-span-3"><Text label="النتيجة / الإثبات" value={row.result} area onChange={(v) => update(index, { result: v })} /></div>
          </div>
        ))}
        {!rows.length ? <p className="rounded-lg border border-dashed p-6 text-center text-xs text-muted">لا توجد إجراءات تصحيحية مفتوحة — وهذا مؤشر جيد إن لم توجد فجوات مرصودة.</p> : null}
      </div>
    </div>
  );
}

function PerformanceReports({ rows, committeeOptions, canEdit, add, update, delegate }: { rows: Row[]; committeeOptions: CommitteeOption[]; canEdit: boolean; add: () => void; update: (index: number, patch: Row) => void; delegate: (type: string, label: string, committeeId?: string) => void }) {
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-bold">تقارير الأداء الدورية</h3>
          <p className="text-xs text-muted">يُستفاد من مؤشرات المتطلبات الأخرى عند توفرها بدل إعادة تعريفها.</p>
        </div>
        {canEdit ? <Button size="sm" onClick={add}><Plus className="h-4 w-4" />إعداد تقرير أداء</Button> : null}
      </div>
      <div className="mt-4 space-y-3">
        {rows.map((row, index) => (
          <div key={String(row.id)} className="rounded-xl border p-4">
            <div className="grid gap-3 md:grid-cols-3">
              <Text label="الفترة" value={row.period} onChange={(v) => update(index, { period: v })} />
              <Text label="الجهة (نصي)" value={row.entity} onChange={(v) => update(index, { entity: v })} />
              <Select label="الحالة" value={row.status} values={["مسودة", "قيد المراجعة", "معتمد"]} onChange={(v) => update(index, { status: v })} />
              <CommitteeMultiSelect label="اللجان/الوحدات المعنية" value={row.committeeIds} options={committeeOptions} onChange={(v) => update(index, { committeeIds: v })} />
              <Text label="نطاق التقرير" value={row.scope} area onChange={(v) => update(index, { scope: v })} />
              <Text label="المؤشرات" value={row.indicators} area onChange={(v) => update(index, { indicators: v })} />
              <div className="md:col-span-3"><Text label="الملخص" value={row.summary} area onChange={(v) => update(index, { summary: v })} /></div>
              <Text label="القرارات الناتجة (وصف)" value={row.resultingDecisions} area onChange={(v) => update(index, { resultingDecisions: v })} />
              <Text label="الإجراءات التصحيحية الناتجة (وصف)" value={row.correctiveActionsNote} area onChange={(v) => update(index, { correctiveActionsNote: v })} />
            </div>
            <div className="mt-3 flex justify-end"><DelegateButton onClick={() => delegate("تقرير أداء", String(row.period || "تقرير بلا فترة محددة"), Array.isArray(row.committeeIds) ? (row.committeeIds as string[])[0] : undefined)} /></div>
          </div>
        ))}
        {!rows.length ? <p className="rounded-lg border border-dashed p-6 text-center text-xs text-muted">لا توجد تقارير أداء موثّقة بعد.</p> : null}
      </div>
    </div>
  );
}

function Tasks({ rows, users, committeeOptions, canEdit, add, update }: { rows: Row[]; users: { id: string; name: string; email: string }[]; committeeOptions: CommitteeOption[]; canEdit: boolean; add: () => void; update: (index: number, patch: Row) => void }) {
  return (
    <div>
      <div className="flex justify-between">
        <div>
          <h3 className="font-bold">مهام المتابعة</h3>
          <p className="text-xs text-muted">أمثلة: تحديث الإجراء، تجهيز بطاقة المبادرة، رفع تقرير الأداء، تنفيذ قرار اللجنة، إغلاق إجراء تصحيحي. المهام المسندة لمستخدم منصة تظهر في «مهامي».</p>
        </div>
        {canEdit ? <Button size="sm" onClick={add}><Plus className="h-4 w-4" />إضافة مهمة</Button> : null}
      </div>
      <div className="mt-4 space-y-3">
        {rows.map((row, index) => (
          <div key={String(row.id)} id={`task-${String(row.id)}`} className="grid gap-3 rounded-xl border p-4 md:grid-cols-4">
            <Text label="المهمة" value={row.title} required onChange={(v) => update(index, { title: v })} />
            <Text label="مرتبطة بسجل (وصف)" value={row.relatedRecordLabel} onChange={(v) => update(index, { relatedRecordLabel: v })} />
            <CommitteeSelect label="اللجنة/الوحدة المرتبطة" value={row.committeeId} options={committeeOptions} onChange={(v) => update(index, { committeeId: v })} />
            <label className="text-xs font-semibold">
              المسؤول (مستخدم المنصة)
              <select disabled={!canEdit} value={String(row.assignedUserId || "")} onChange={(event) => { const user = users.find((item) => item.id === event.target.value); update(index, { assignedUserId: event.target.value, assignee: user?.name || row.assignee }); }} className="mt-1 h-9 w-full rounded-lg border bg-transparent px-3 text-xs">
                <option value="">مسؤول نصي فقط</option>
                {users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
              </select>
            </label>
            <Text label="الموعد النهائي" type="date" value={row.dueDate} onChange={(v) => update(index, { dueDate: v })} />
            <Select label="الحالة" value={row.status} values={Object.keys(TASK_STATUS_LABELS)} labels={TASK_STATUS_LABELS} onChange={(v) => update(index, { status: v, completedAt: v === "COMPLETED" ? new Date().toISOString() : null })} />
            <div className="md:col-span-2"><Text label="الوصف/الملاحظات" value={row.description} area onChange={(v) => update(index, { description: v })} /></div>
          </div>
        ))}
        {!rows.length ? <p className="rounded-lg border border-dashed p-6 text-center text-xs text-muted">لا توجد مهام متابعة بعد. أضِفها من هنا أو من زر «إسناد متابعة» داخل أي سجل.</p> : null}
      </div>
    </div>
  );
}

function Log({ rows }: { rows: Row[] }) {
  return (
    <div>
      <h3 className="font-bold">السجل</h3>
      <p className="text-xs text-muted">سجل تشغيلي خفيف لأحداث هذه المساحة. سجل التدقيق الكامل والمعتمد متاح أسفل الصفحة.</p>
      <div className="mt-3 space-y-2">
        {rows.map((row, index) => (
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
