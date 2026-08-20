"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, GitBranch, Plus, Table2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { WorkspaceData } from "../workspace-status";
import { MECHANISM_APPROVAL_STATUSES, isCurrentMechanismVersion } from "../workspace-config";
import type { ContributionView } from "@/modules/requirement-contributions/types";

type Row = Record<string, unknown>;
type EvidenceRow = { id: string; classification: string | null; reviewStatus: string; relatedRecord?: string | null };
type UserOption = { id: string; name: string; email: string };
type CommitteeOption = { id: string; name: string };
type InitiativeOption = { id: string; name: string; owner?: string; status?: string };

const tabs = ["نظرة عامة", "خارطة الرحلة", "بوابات القرار", "المهام", "المسار المرجعي", "الأدلة والاعتماد", "سجل النشاط"] as const;
type Tab = (typeof tabs)[number];
const TASK_STATUS_LABELS: Record<string, string> = { NOT_STARTED: "لم تبدأ", IN_PROGRESS: "قيد التنفيذ", WAITING: "بانتظار طرف آخر", REVIEW: "بانتظار مراجعة", COMPLETED: "مكتملة", OVERDUE: "متأخرة", CANCELLED: "ملغاة" };
const TASK_PRESETS = ["توثيق مرحلة التصميم", "مراجعة إجراءات التطوير", "إضافة نموذج اعتماد", "تحديث مسؤوليات التنفيذ"] as const;
const STAGE_NAME_PRESETS = ["فكرة", "دراسة", "تصميم", "تطوير", "اختبار", "تنفيذ", "متابعة"] as const;
const TEMPLATE_CATEGORIES = ["نموذج", "قالب", "إجراء", "سياسة", "checklist", "مستند داعم"] as const;

const newId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const arr = (value: unknown) => (Array.isArray(value) ? (value as Row[]) : []);
const gateOf = (stage: Row): Row => (stage.gate && typeof stage.gate === "object" ? (stage.gate as Row) : {});
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
function Select({ label, value, values, onChange, required = false, placeholder = "اختر" }: { label: string; value: unknown; values: readonly string[]; onChange: (value: string) => void; required?: boolean; placeholder?: string }) {
  const editable = useContext(EditContext);
  return (
    <label className="text-xs font-semibold">
      {label}
      {required ? <span className="text-danger"> *</span> : null}
      <select disabled={!editable} value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} className="mt-1 h-9 w-full rounded-lg border bg-transparent px-3 text-xs disabled:cursor-not-allowed disabled:opacity-70">
        <option value="">{placeholder}</option>
        {values.map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
    </label>
  );
}
function Repeatable({ title, hint, rows, fields, add, update }: { title: string; hint?: string; rows: Row[]; fields: [string, string][]; add: () => void; update: (index: number, patch: Row) => void }) {
  const canEdit = useContext(EditContext);
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

export function DigitalInnovationMechanismWorkspace({
  data,
  canEdit,
  onChange,
  personaKey = "admin",
  users = [],
  evidence = [],
  referenceData = {},
  contributions = [],
  initialVersionId,
}: {
  data: WorkspaceData;
  canEdit: boolean;
  onChange: (data: WorkspaceData) => void;
  personaKey?: string;
  users?: UserOption[];
  evidence?: EvidenceRow[];
  referenceData?: WorkspaceData;
  contributions?: ContributionView[];
  initialVersionId?: string;
}) {
  const versions = arr(data.mechanismVersions);
  const initialIndex = versions.findIndex((row) => row.id === initialVersionId);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(initialIndex >= 0 ? initialIndex : null);
  const [tab, setTab] = useState<Tab>("نظرة عامة");
  const [roadmapView, setRoadmapView] = useState<"roadmap" | "table">("roadmap");
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash.startsWith("#task-")) setTab("المهام");
  }, [selectedIndex]);
  const restricted = personaKey === "viewer" || personaKey === "partner";
  const availableTabs = restricted ? tabs.filter((item) => !["المهام", "سجل النشاط"].includes(item)) : tabs;

  const committeeOptions = useMemo<CommitteeOption[]>(() => arr(referenceData.structures).map((row) => ({ id: String(row.committeeId ?? row.id ?? ""), name: String(row.name ?? "") })).filter((row) => row.id && row.name), [referenceData.structures]);
  const initiativeOptions = useMemo<InitiativeOption[]>(() => arr(referenceData.initiatives).map((row) => ({ id: String(row.id ?? row.name ?? ""), name: String(row.name ?? ""), owner: String(row.owner ?? ""), status: String(row.status ?? "") })).filter((row) => row.name), [referenceData.initiatives]);
  const processOptions = useMemo(() => arr(referenceData.processes).map((row) => String(row.name ?? "")).filter(Boolean), [referenceData.processes]);

  const current = versions.find(isCurrentMechanismVersion) ?? versions[versions.length - 1] ?? null;
  const currentStages = arr(current?.stages).filter((row) => !row.archived);
  const openTasks = versions.flatMap((v) => arr(v.stages)).flatMap((s) => arr(s.tasks)).filter((task) => !["COMPLETED", "CANCELLED"].includes(String(task.status))).length;
  const pendingContributions = contributions.filter((item) => !["COMPLETED", "CANCELLED"].includes(item.status)).length;
  const approvedEvidence = evidence.some((item) => item.classification === "DIGITAL_INNOVATION_MECHANISM" && item.reviewStatus === "APPROVED");
  const readinessGaps = [
    !versions.length ? "لم تُوثَّق أي آلية لإدارة الابتكار الرقمي بعد" : null,
    current && current.approvalStatus !== "معتمد" ? `لا يوجد إصدار معتمد حاليًا كإصدار رسمي — أحدث إصدار (${String(current.version || "—")}) بحالة «${String(current.approvalStatus || "غير محددة")}»` : null,
    current && !currentStages.length ? "لم تُوثَّق أي مرحلة ضمن خارطة رحلة الإصدار الحالي" : null,
    current && currentStages.some((s) => !String(s.owner || "").trim() || !String(s.responsibleRole || "").trim()) ? "توجد مراحل بلا مالك أو دور مسؤول محدد" : null,
    current && currentStages.some((s) => !String(gateOf(s).owner || "").trim()) ? "توجد مراحل بلا مالك بوابة قرار محدد" : null,
    !approvedEvidence ? "لا يوجد دليل معتمد يثبت آلية إدارة الابتكار الرقمي" : null,
    openTasks > 0 ? `${openTasks} مهمة توثيق/صيانة مفتوحة` : null,
    pendingContributions > 0 ? `${pendingContributions} توكيل/مساهمة مسندة قيد الإنجاز` : null,
  ].filter((item): item is string => Boolean(item));
  const nextAction = readinessGaps[0] ?? "لا يوجد نقص ظاهر — الآلية موثّقة ومعتمدة بخارطة رحلة ومسؤوليات وبوابات قرار واضحة.";

  function replaceVersion(index: number, next: Row) { onChange({ ...data, mechanismVersions: versions.map((row, i) => (i === index ? next : row)) }); }
  function openVersion(index: number) {
    setSelectedIndex(index);
    setTab("نظرة عامة");
    setSelectedStageId(null);
    const row = versions[index];
    if (row?.id && typeof window !== "undefined") window.history.pushState({}, "", `/governance/requirements/5-23-3-r4/mechanism/${row.id}${window.location.search}`);
  }
  function createVersion(duplicateFrom?: Row) {
    const nextVersionNumber = duplicateFrom ? String(Number(duplicateFrom.version) + 1 || `${versions.length + 1}.0`) : "1.0";
    const next: Row = {
      id: newId("mechanism-version"),
      name: String(duplicateFrom?.name ?? "آلية إدارة الابتكار الرقمي"),
      description: String(duplicateFrom?.description ?? ""),
      owner: String(duplicateFrom?.owner ?? ""),
      version: nextVersionNumber,
      createdDate: new Date().toISOString().slice(0, 10),
      effectiveDate: "",
      approvalStatus: "مسودة",
      approvingAuthority: String(duplicateFrom?.approvingAuthority ?? ""),
      nextReviewDate: "",
      stages: duplicateFrom ? arr(duplicateFrom.stages).map((stage) => ({ ...stage, id: newId("stage"), tasks: [] })) : [],
      trace: [],
      log: [{ date: new Date().toISOString(), action: duplicateFrom ? `إنشاء إصدار جديد ${nextVersionNumber} استنادًا إلى الإصدار ${String(duplicateFrom.version ?? "")}` : "توثيق أول إصدار لآلية إدارة الابتكار الرقمي" }],
    };
    onChange({ ...data, mechanismVersions: [...versions, next] });
    setSelectedIndex(versions.length);
    setTab("نظرة عامة");
    setNotice(duplicateFrom ? "أُنشئ إصدار جديد بمراحل الإصدار الحالي كنقطة بداية. راجع البيانات ثم اعتمد الإصدار عند اكتماله." : "تم توثيق الإصدار الأول للآلية. أكمل بياناتها ومراحلها ثم اعتمدها.");
  }
  function update(key: string, value: unknown) { if (selectedIndex === null) return; replaceVersion(selectedIndex, { ...versions[selectedIndex], [key]: value, log: [{ date: new Date().toISOString(), action: "تحديث بيانات إصدار الآلية" }, ...arr(versions[selectedIndex]?.log)] }); }
  function updateApprovalStatus(value: string) {
    if (selectedIndex === null) return;
    let next = versions.map((v, i) => (i === selectedIndex ? { ...v, approvalStatus: value, log: [{ date: new Date().toISOString(), action: `تغيير حالة الاعتماد إلى «${value}»` }, ...arr(v.log)] } : v));
    if (value === "معتمد") {
      next = next.map((v, i) => (i !== selectedIndex && v.approvalStatus === "معتمد" ? { ...v, approvalStatus: "تم الاستبدال", log: [{ date: new Date().toISOString(), action: `استُبدل هذا الإصدار بالإصدار ${String(next[selectedIndex].version ?? "")} بعد اعتماده` }, ...arr(v.log)] } : v));
      setNotice("اعتُمد هذا الإصدار كإصدار حالي، وتحوّل أي إصدار معتمد سابقًا إلى «تم الاستبدال» مع بقائه قابلًا للقراءة للتتبع.");
    }
    onChange({ ...data, mechanismVersions: next });
  }
  function stages() { return selectedIndex === null ? [] : arr(versions[selectedIndex]?.stages); }
  function updateStages(next: Row[]) { update("stages", next); }
  function addStage(name?: string) {
    const stage: Row = { id: newId("stage"), name: name || "مرحلة جديدة", description: "", objective: "", entryCriteria: "", activities: "", owner: "", responsibleRole: "", supportingDepartments: "", requiredInputs: "", expectedOutputs: "", slaDuration: "", governanceProcessName: "", evidenceNotes: "", archived: false, templates: [], tasks: [], gate: { owner: "", committees: [], requiredInputs: "", outcome: "", notes: "" } };
    updateStages([...stages(), stage]);
    setSelectedStageId(stage.id as string);
  }
  function patchStage(stageId: string, patch: Row) { updateStages(stages().map((s) => (s.id === stageId ? { ...s, ...patch } : s))); }
  function moveStage(stageId: string, direction: -1 | 1) {
    const rows = stages(); const index = rows.findIndex((s) => s.id === stageId); const target = index + direction;
    if (index < 0 || target < 0 || target >= rows.length) return;
    const next = [...rows]; [next[index], next[target]] = [next[target], next[index]];
    updateStages(next);
  }
  function archiveStage(stageId: string) {
    const stage = stages().find((s) => s.id === stageId); if (!stage) return;
    const openStageTasks = arr(stage.tasks).some((t) => !["COMPLETED", "CANCELLED"].includes(String(t.status)));
    if (openStageTasks) { setNotice("لا يمكن أرشفة هذه المرحلة: توجد مهام مفتوحة مرتبطة بها. أكمل المهام أولًا."); return; }
    patchStage(stageId, { archived: !stage.archived });
  }
  function addStageRecord(stageId: string, key: string, row: Row) { const stage = stages().find((s) => s.id === stageId); patchStage(stageId, { [key]: [...arr(stage?.[key]), row] }); }
  function patchStageRecord(stageId: string, key: string, index: number, patch: Row) { const stage = stages().find((s) => s.id === stageId); patchStage(stageId, { [key]: arr(stage?.[key]).map((row, i) => (i === index ? { ...row, ...patch } : row)) }); }

  const currentVersionForEdit = selectedIndex === null ? null : versions[selectedIndex];
  const versionEditable = canEdit && currentVersionForEdit?.approvalStatus !== "تم الاستبدال";

  if (currentVersionForEdit === null) {
    return (
      <div className="space-y-5">
        <Card className="border-primary/20">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle>آلية إدارة الابتكار الرقمي</CardTitle>
                <p className="mt-1 text-xs text-muted">تعريف مؤسسي مُصدَّر لخارطة رحلة الابتكار الرقمي — لا تُدار هنا مشاريع فردية، بل الآلية والمراحل والمسؤوليات وبوابات القرار المعتمدة.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {current ? <Badge variant={current.approvalStatus === "معتمد" ? "success" : "warning"}>الإصدار الحالي: {String(current.version || "—")} · {String(current.approvalStatus || "غير محددة")}</Badge> : null}
                {canEdit ? (
                  <div className="flex flex-wrap gap-2">
                    {!versions.length ? <Button size="sm" onClick={() => createVersion()}><Plus className="h-4 w-4" />توثيق الآلية لأول مرة</Button> : <Button size="sm" onClick={() => createVersion(current ?? undefined)}><Plus className="h-4 w-4" />إصدار جديد من الحالي</Button>}
                  </div>
                ) : null}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 text-center text-xs sm:grid-cols-4">
              {[[versions.length, "الإصدارات"], [currentStages.length, "مراحل الإصدار الحالي"], [openTasks, "مهمة مفتوحة"], [pendingContributions, "مساهمة معلّقة"]].map(([value, label]) => (
                <div key={String(label)} className="rounded-lg border p-2"><b>{value}</b><p className="text-muted">{label}</p></div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>الجاهزية</CardTitle><p className="mt-1 text-xs text-muted">توثيق الآلية لا يعني اعتمادها رسميًا — الجاهزية توضيح للفجوات الفعلية دون درجة مُخترعة.</p></CardHeader>
          <CardContent className="space-y-2">
            {readinessGaps.length ? readinessGaps.map((gap) => <p key={gap} className="flex items-center gap-2 text-xs leading-5"><AlertTriangle className="h-4 w-4 shrink-0 text-warning" />{gap}</p>) : <p className="flex items-center gap-2 text-sm text-success"><CheckCircle2 className="h-5 w-5" />لا يوجد نقص ظاهر حاليًا.</p>}
            <p className="mt-2 rounded-lg bg-primary-50 p-3 text-xs"><b>الإجراء التالي:</b> {nextAction}</p>
          </CardContent>
        </Card>
        <div className="grid gap-4 xl:grid-cols-2">
          {[...versions].reverse().map((row) => {
            const index = versions.indexOf(row);
            const stageCount = arr(row.stages).length;
            return (
              <Card key={String(row.id)}>
                <CardContent className="p-5">
                  <div className="flex flex-wrap justify-between gap-3">
                    <div>
                      <Badge variant={row.approvalStatus === "معتمد" ? "success" : row.approvalStatus === "تم الاستبدال" ? "neutral" : "warning"}>{String(row.approvalStatus || "بلا حالة")}</Badge>
                      <h3 className="mt-2 font-bold">{String(row.name || "—")} · الإصدار {String(row.version || "—")}</h3>
                      <p className="mt-1 text-xs text-muted">{String(row.owner || "المالك غير محدد")} · سريان {String(row.effectiveDate || "—")}</p>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-muted">{stageCount} مرحلة موثّقة{row.nextReviewDate ? ` · المراجعة القادمة ${String(row.nextReviewDate)}` : ""}</p>
                  <div className="mt-4 flex items-center justify-end"><Button size="sm" onClick={() => openVersion(index)}>فتح الإصدار <ArrowLeft className="h-4 w-4" /></Button></div>
                </CardContent>
              </Card>
            );
          })}
          {!versions.length ? <Card className="xl:col-span-2"><CardContent className="p-10 text-center text-sm text-muted">لا توجد إصدارات موثّقة بعد. وثّق الآلية لأول مرة لبدء خارطة الرحلة.</CardContent></Card> : null}
        </div>
        {notice ? <p className="rounded-lg bg-primary-50 p-3 text-sm">{notice}</p> : null}
      </div>
    );
  }

  const versionStages = stages();
  const selectedStage = versionStages.find((s) => s.id === selectedStageId) ?? null;

  return (
    <EditContext.Provider value={versionEditable}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" onClick={() => setSelectedIndex(null)}><ArrowLeft className="h-4 w-4" />آلية إدارة الابتكار الرقمي</Button>
          <Badge variant={currentVersionForEdit.approvalStatus === "معتمد" ? "success" : currentVersionForEdit.approvalStatus === "تم الاستبدال" ? "neutral" : "warning"}>{String(currentVersionForEdit.approvalStatus || "بلا حالة")}</Badge>
        </div>
        {currentVersionForEdit.approvalStatus === "تم الاستبدال" ? <p className="flex items-center gap-2 rounded-lg bg-warning-bg p-3 text-xs text-warning"><AlertTriangle className="h-4 w-4" />هذا إصدار سابق مُستبدَل ومحفوظ للاطّلاع والتتبع فقط — التعديل غير متاح عليه. عدّل الإصدار الحالي المعتمد أو أنشئ إصدارًا جديدًا.</p> : null}
        <Card className="border-primary/20">
          <CardContent className="p-5">
            <div className="flex flex-wrap justify-between gap-3">
              <div><h2 className="text-xl font-bold">{String(currentVersionForEdit.name || "—")}</h2><p className="mt-1 text-xs text-muted">الإصدار {String(currentVersionForEdit.version || "—")} · {String(currentVersionForEdit.owner || "—")}</p></div>
            </div>
          </CardContent>
        </Card>
        <div className="flex gap-2 overflow-x-auto pb-2">{availableTabs.map((item) => <Button key={item} size="sm" variant={tab === item ? "default" : "outline"} onClick={() => setTab(item)}>{item}</Button>)}</div>
        <div>
          {tab === "نظرة عامة" ? (
            <Card>
              <CardHeader><CardTitle>بيانات الآلية (الإصدار الحالي المفتوح)</CardTitle></CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2">
                <Text label="اسم الآلية" value={currentVersionForEdit.name} required onChange={(v) => update("name", v)} />
                <Text label="المالك" value={currentVersionForEdit.owner} required onChange={(v) => update("owner", v)} />
                <Text label="الإصدار" value={currentVersionForEdit.version} required onChange={(v) => update("version", v)} />
                <Select label="حالة الاعتماد" value={currentVersionForEdit.approvalStatus} values={MECHANISM_APPROVAL_STATUSES} required onChange={updateApprovalStatus} />
                <Text label="تاريخ الإنشاء" type="date" value={currentVersionForEdit.createdDate} onChange={(v) => update("createdDate", v)} />
                <Text label="تاريخ السريان" type="date" value={currentVersionForEdit.effectiveDate} onChange={(v) => update("effectiveDate", v)} />
                <Text label="جهة الاعتماد" value={currentVersionForEdit.approvingAuthority} required onChange={(v) => update("approvingAuthority", v)} />
                <Text label="تاريخ المراجعة القادمة (اختياري)" type="date" value={currentVersionForEdit.nextReviewDate} onChange={(v) => update("nextReviewDate", v)} />
                <div className="md:col-span-2"><Text label="الوصف" value={currentVersionForEdit.description} area required onChange={(v) => update("description", v)} /></div>
              </CardContent>
            </Card>
          ) : null}
          {tab === "خارطة الرحلة" ? (
            <RoadmapTab
              stages={versionStages}
              view={roadmapView}
              setView={setRoadmapView}
              selectedStageId={selectedStageId}
              setSelectedStageId={setSelectedStageId}
              selectedStage={selectedStage}
              committeeOptions={committeeOptions}
              processOptions={processOptions}
              users={users}
              addStage={addStage}
              moveStage={moveStage}
              archiveStage={archiveStage}
              patchStage={patchStage}
              addStageRecord={addStageRecord}
              patchStageRecord={patchStageRecord}
            />
          ) : null}
          {tab === "بوابات القرار" ? (
            <GatesTab stages={versionStages} committeeOptions={committeeOptions} patchStage={patchStage} openStage={(id) => { setSelectedStageId(id); setTab("خارطة الرحلة"); }} />
          ) : null}
          {tab === "المهام" && !restricted ? (
            <StageTasksTab stages={versionStages} users={users} addStageRecord={addStageRecord} patchStageRecord={patchStageRecord} />
          ) : null}
          {tab === "المسار المرجعي" ? (
            <TraceTab trace={arr(currentVersionForEdit.trace)} stages={versionStages} initiativeOptions={initiativeOptions} update={(rows) => update("trace", rows)} />
          ) : null}
          {tab === "الأدلة والاعتماد" ? (
            <EvidenceApprovalTab current={currentVersionForEdit} stages={versionStages} evidence={evidence} versions={versions} />
          ) : null}
          {tab === "سجل النشاط" && !restricted ? <Log rows={arr(currentVersionForEdit.log)} /> : null}
        </div>
        {notice ? <p className="rounded-lg bg-primary-50 p-3 text-sm">{notice}</p> : null}
      </div>
    </EditContext.Provider>
  );
}

function RoadmapTab({ stages, view, setView, selectedStageId, setSelectedStageId, selectedStage, committeeOptions, processOptions, users, addStage, moveStage, archiveStage, patchStage, addStageRecord, patchStageRecord }: {
  stages: Row[]; view: "roadmap" | "table"; setView: (v: "roadmap" | "table") => void; selectedStageId: string | null; setSelectedStageId: (id: string | null) => void; selectedStage: Row | null;
  committeeOptions: CommitteeOption[]; processOptions: string[]; users: UserOption[];
  addStage: (name?: string) => void; moveStage: (stageId: string, direction: -1 | 1) => void; archiveStage: (stageId: string) => void;
  patchStage: (stageId: string, patch: Row) => void; addStageRecord: (stageId: string, key: string, row: Row) => void; patchStageRecord: (stageId: string, key: string, index: number, patch: Row) => void;
}) {
  const canEdit = useContext(EditContext);
  const [preset, setPreset] = useState<string>(STAGE_NAME_PRESETS[0]);
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>خارطة الرحلة</CardTitle>
              <p className="mt-1 text-xs text-muted">مراحل قابلة للإضافة وإعادة التسمية والترتيب والأرشفة الآمنة من قِبل الجهة — الأسماء المعروضة أمثلة توضيحية وليست قيمًا رسمية مفروضة.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex overflow-hidden rounded-lg border">
                <button type="button" onClick={() => setView("roadmap")} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold ${view === "roadmap" ? "bg-primary text-white" : ""}`}><GitBranch className="h-3.5 w-3.5" />عرض خارطة الرحلة</button>
                <button type="button" onClick={() => setView("table")} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold ${view === "table" ? "bg-primary text-white" : ""}`}><Table2 className="h-3.5 w-3.5" />عرض جدولي</button>
              </div>
              {canEdit ? (
                <div className="flex flex-wrap items-center gap-2">
                  <select value={preset} onChange={(event) => setPreset(event.target.value)} className="h-9 rounded-lg border bg-transparent px-2 text-xs">{STAGE_NAME_PRESETS.map((item) => <option key={item} value={item}>{item}</option>)}</select>
                  <Button size="sm" onClick={() => addStage(preset)}><Plus className="h-4 w-4" />إضافة مرحلة</Button>
                </div>
              ) : null}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {view === "roadmap" ? (
            <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap">
              {stages.map((stage, index) => (
                <div key={String(stage.id)} className={`min-w-0 flex-1 rounded-xl border p-4 lg:min-w-[180px] ${stage.archived ? "opacity-50" : ""} ${selectedStageId === stage.id ? "border-primary ring-1 ring-primary" : ""}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary-50 text-xs font-bold text-primary">{index + 1}</span>
                    {canEdit ? (
                      <div className="flex gap-1">
                        <button type="button" disabled={index === 0} onClick={() => moveStage(String(stage.id), -1)} className="text-xs disabled:opacity-30" aria-label="تحريك لأعلى">▲</button>
                        <button type="button" disabled={index === stages.length - 1} onClick={() => moveStage(String(stage.id), 1)} className="text-xs disabled:opacity-30" aria-label="تحريك لأسفل">▼</button>
                      </div>
                    ) : null}
                  </div>
                  <p className="mt-2 truncate text-sm font-bold">{String(stage.name || "—")}</p>
                  {stage.archived ? <Badge className="mt-1" variant="neutral">مؤرشفة</Badge> : null}
                  <p className="mt-1 line-clamp-2 text-[11px] text-muted">{String(stage.objective || "بلا هدف موثّق")}</p>
                  <div className="mt-3 flex items-center justify-between">
                    <Button size="sm" variant="outline" onClick={() => setSelectedStageId(stage.id === selectedStageId ? null : String(stage.id))}>{selectedStageId === stage.id ? "إغلاق التفاصيل" : "فتح المرحلة"}</Button>
                    {canEdit ? <button type="button" onClick={() => archiveStage(String(stage.id))} className="text-[11px] text-muted underline">{stage.archived ? "إلغاء الأرشفة" : "أرشفة"}</button> : null}
                  </div>
                  {index < stages.length - 1 ? <p className="mt-2 text-center text-[10px] text-muted">↓ التالية: {String(stages[index + 1]?.name || "—")}</p> : null}
                </div>
              ))}
              {!stages.length ? <p className="w-full rounded-lg border border-dashed p-6 text-center text-xs text-muted">لا توجد مراحل موثّقة بعد.</p> : null}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-xs">
                <thead><tr className="border-b text-muted">{["المرحلة", "الهدف", "المالك", "الإدارات المشاركة", "المدخلات", "الإجراءات", "المخرجات", "نقطة القرار", "المسؤول عن القرار", "النماذج/القوالب", "مدة/SLA", "المرحلة التالية"].map((h) => <th key={h} className="p-2 text-start">{h}</th>)}</tr></thead>
                <tbody>
                  {stages.map((stage, index) => (
                    <tr key={String(stage.id)} className={`border-b ${stage.archived ? "opacity-50" : ""}`}>
                      <td className="p-2 font-semibold">{String(stage.name || "—")}{stage.archived ? <Badge className="mr-1" variant="neutral">مؤرشفة</Badge> : null}</td>
                      <td className="max-w-[160px] p-2">{String(stage.objective || "—")}</td>
                      <td className="p-2">{String(stage.owner || "—")}</td>
                      <td className="max-w-[140px] p-2">{String(stage.supportingDepartments || "—")}</td>
                      <td className="max-w-[140px] p-2">{String(stage.requiredInputs || "—")}</td>
                      <td className="max-w-[160px] p-2">{String(stage.activities || "—")}</td>
                      <td className="max-w-[140px] p-2">{String(stage.expectedOutputs || "—")}</td>
                      <td className="p-2">{String(gateOf(stage).outcome || "غير معرّفة بعد")}</td>
                      <td className="p-2">{String(gateOf(stage).owner || "—")}</td>
                      <td className="p-2">{arr(stage.templates).length}</td>
                      <td className="p-2">{String(stage.slaDuration || "—")}</td>
                      <td className="p-2">{String(stages[index + 1]?.name || "نهاية الرحلة")}</td>
                    </tr>
                  ))}
                  {!stages.length ? <tr><td colSpan={12} className="p-6 text-center text-muted">لا توجد مراحل موثّقة بعد.</td></tr> : null}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      {selectedStage ? <StageDetail stage={selectedStage} committeeOptions={committeeOptions} processOptions={processOptions} users={users} patchStage={patchStage} addStageRecord={addStageRecord} patchStageRecord={patchStageRecord} /> : null}
    </div>
  );
}

function StageDetail({ stage, committeeOptions, processOptions, users, patchStage, addStageRecord, patchStageRecord }: {
  stage: Row; committeeOptions: CommitteeOption[]; processOptions: string[]; users: UserOption[];
  patchStage: (stageId: string, patch: Row) => void; addStageRecord: (stageId: string, key: string, row: Row) => void; patchStageRecord: (stageId: string, key: string, index: number, patch: Row) => void;
}) {
  const canEdit = useContext(EditContext);
  const stageId = String(stage.id);
  const gate = gateOf(stage);
  const updateGate = (patch: Row) => patchStage(stageId, { gate: { ...gate, ...patch } });
  const toggleCommittee = (id: string) => { const list = Array.isArray(gate.committees) ? (gate.committees as string[]) : []; updateGate({ committees: list.includes(id) ? list.filter((c) => c !== id) : [...list, id] }); };
  const templates = arr(stage.templates);
  return (
    <Card id={`stage-${stageId}`} className="border-primary/20">
      <CardHeader><CardTitle>تفاصيل المرحلة: {String(stage.name || "—")}</CardTitle></CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 md:grid-cols-2">
          <Text label="اسم المرحلة" value={stage.name} required onChange={(v) => patchStage(stageId, { name: v })} />
          <Text label="مدة/SLA (اختياري — لا تُفرض قيمة افتراضية)" value={stage.slaDuration} onChange={(v) => patchStage(stageId, { slaDuration: v })} />
          <Text label="المالك" value={stage.owner} required onChange={(v) => patchStage(stageId, { owner: v })} />
          <Text label="الدور/الجهة المسؤولة عن التنفيذ" value={stage.responsibleRole} required onChange={(v) => patchStage(stageId, { responsibleRole: v })} />
          <Text label="الإدارات المشاركة" value={stage.supportingDepartments} onChange={(v) => patchStage(stageId, { supportingDepartments: v })} />
          <Select label="العملية/الإجراء المرتبط من المتطلب 5.23.3.2 (دون إعادة إنشائها)" value={stage.governanceProcessName} values={processOptions} placeholder="بلا ربط" onChange={(v) => patchStage(stageId, { governanceProcessName: v })} />
          <div className="md:col-span-2"><Text label="الوصف" value={stage.description} area onChange={(v) => patchStage(stageId, { description: v })} /></div>
          <Text label="الهدف" value={stage.objective} area onChange={(v) => patchStage(stageId, { objective: v })} />
          <Text label="معايير الدخول" value={stage.entryCriteria} area onChange={(v) => patchStage(stageId, { entryCriteria: v })} />
          <Text label="الإجراءات/الأنشطة" value={stage.activities} area onChange={(v) => patchStage(stageId, { activities: v })} />
          <Text label="المدخلات المطلوبة" value={stage.requiredInputs} area onChange={(v) => patchStage(stageId, { requiredInputs: v })} />
          <Text label="المخرجات المتوقعة" value={stage.expectedOutputs} area onChange={(v) => patchStage(stageId, { expectedOutputs: v })} />
          <Text label="ملاحظات تجهيز الإثبات (لا تُعد بديلًا عن مستودع الإثبات)" value={stage.evidenceNotes} area onChange={(v) => patchStage(stageId, { evidenceNotes: v })} />
        </div>

        <div>
          <p className="mb-2 text-xs font-bold">بوابة القرار عند الانتقال من هذه المرحلة</p>
          <div className="grid gap-3 rounded-xl border p-3 md:grid-cols-2">
            <Text label="مالك القرار" value={gate.owner} onChange={(v) => updateGate({ owner: v })} />
            <Text label="نتيجة القرار (مثال: اعتماد الانتقال / إعادة للدراسة / إيقاف / طلب تعديل — أو أي قيمة تعتمدها الجهة)" value={gate.outcome} onChange={(v) => updateGate({ outcome: v })} />
            <Text label="المدخلات المطلوبة للقرار" value={gate.requiredInputs} area onChange={(v) => updateGate({ requiredInputs: v })} />
            <Text label="ملاحظات" value={gate.notes} area onChange={(v) => updateGate({ notes: v })} />
            <div className="md:col-span-2">
              <p className="text-xs font-semibold">اللجنة/اللجان المعنية (من المتطلب 5.23.3.1 فقط)</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {committeeOptions.map((committee) => {
                  const selected = Array.isArray(gate.committees) && (gate.committees as string[]).includes(committee.id);
                  return <button key={committee.id} type="button" disabled={!canEdit} onClick={() => toggleCommittee(committee.id)} className={`rounded-full border px-3 py-1 text-[11px] font-semibold disabled:cursor-not-allowed ${selected ? "border-primary bg-primary-50 text-primary" : ""}`}>{committee.name}</button>;
                })}
                {!committeeOptions.length ? <p className="text-[11px] text-muted">لا توجد وحدات/لجان موثّقة في المتطلب 01 بعد.</p> : null}
              </div>
            </div>
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between"><p className="text-xs font-bold">النماذج/القوالب المرتبطة</p>{canEdit ? <Button size="sm" variant="outline" onClick={() => addStageRecord(stageId, "templates", { id: newId("template"), title: "نموذج جديد", category: "نموذج", fileName: "", reviewState: "مسودة", markedAsEvidence: "لا" })}><Plus className="h-4 w-4" />إضافة نموذج/قالب</Button> : null}</div>
          <div className="grid gap-3 md:grid-cols-2">
            {templates.map((row, index) => (
              <div key={String(row.id)} className="rounded-xl border p-3">
                <Text label="العنوان" value={row.title} onChange={(v) => patchStageRecord(stageId, "templates", index, { title: v })} />
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Select label="الفئة" value={row.category} values={TEMPLATE_CATEGORIES} onChange={(v) => patchStageRecord(stageId, "templates", index, { category: v })} />
                  <Text label="اسم الملف/الرابط" value={row.fileName} onChange={(v) => patchStageRecord(stageId, "templates", index, { fileName: v })} />
                  <Select label="حالة المراجعة" value={row.reviewState} values={["مسودة", "قيد المراجعة", "يحتاج تعديل", "معتمد"]} onChange={(v) => patchStageRecord(stageId, "templates", index, { reviewState: v })} />
                  <Select label="مرشح للإثبات" value={row.markedAsEvidence} values={["لا", "نعم"]} onChange={(v) => patchStageRecord(stageId, "templates", index, { markedAsEvidence: v })} />
                </div>
              </div>
            ))}
            {!templates.length ? <p className="col-span-full rounded-lg border border-dashed p-6 text-center text-xs text-muted">لا توجد نماذج أو قوالب مرتبطة بهذه المرحلة بعد.</p> : null}
          </div>
        </div>

        <p className="rounded-lg bg-primary-50 p-3 text-[11px]">مادة العمل (النموذج/القالب) ليست إثباتًا رسميًا تلقائيًا — اربط السجل المناسب كدليل عبر مستودع الإثبات عند اكتماله.</p>
        <p className="text-[11px] text-muted">لتوزيع مهام توثيق أو صيانة هذه المرحلة استخدم تبويب «المهام».</p>
      </CardContent>
    </Card>
  );
}

function GatesTab({ stages, committeeOptions, patchStage, openStage }: { stages: Row[]; committeeOptions: CommitteeOption[]; patchStage: (stageId: string, patch: Row) => void; openStage: (stageId: string) => void }) {
  const nonArchived = stages.filter((s) => !s.archived);
  return (
    <Card>
      <CardHeader><CardTitle>بوابات القرار بين المراحل</CardTitle><p className="mt-1 text-xs text-muted">مراجعة إدارية موحّدة لكل بوابات القرار المعرّفة داخل المراحل — التعديل الكامل من تبويب «خارطة الرحلة».</p></CardHeader>
      <CardContent className="space-y-3">
        {nonArchived.map((stage, index) => {
          const gate = gateOf(stage);
          const committeeNames = (Array.isArray(gate.committees) ? (gate.committees as string[]) : []).map((id) => committeeOptions.find((c) => c.id === id)?.name).filter(Boolean);
          return (
            <div key={String(stage.id)} className="rounded-xl border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-bold">{String(stage.name || "—")} ← {String(nonArchived[index + 1]?.name || "نهاية الرحلة")}</p>
                <Button size="sm" variant="outline" onClick={() => openStage(String(stage.id))}>فتح المرحلة</Button>
              </div>
              <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                <p><b>مالك القرار:</b> {String(gate.owner || "غير محدد")}</p>
                <p><b>النتيجة:</b> {String(gate.outcome || "لم تُتخذ بعد")}</p>
                <p><b>اللجان المعنية:</b> {committeeNames.length ? committeeNames.join("، ") : "بلا لجنة محددة"}</p>
                <p><b>المدخلات المطلوبة:</b> {String(gate.requiredInputs || "—")}</p>
              </div>
              {!gate.owner ? <p className="mt-2 flex items-center gap-1.5 text-[11px] text-warning"><AlertTriangle className="h-3.5 w-3.5" />بوابة القرار غير معرّفة بعد لهذه المرحلة.</p> : null}
            </div>
          );
        })}
        {!nonArchived.length ? <p className="rounded-lg border border-dashed p-6 text-center text-xs text-muted">لا توجد مراحل نشطة لعرض بوابات قرارها.</p> : null}
      </CardContent>
    </Card>
  );
}

function StageTasksTab({ stages, users, addStageRecord, patchStageRecord }: { stages: Row[]; users: UserOption[]; addStageRecord: (stageId: string, key: string, row: Row) => void; patchStageRecord: (stageId: string, key: string, index: number, patch: Row) => void }) {
  const canEdit = useContext(EditContext);
  const nonArchived = stages.filter((s) => !s.archived);
  const [stageId, setStageId] = useState<string>(String(nonArchived[0]?.id ?? ""));
  const [preset, setPreset] = useState<string>(TASK_PRESETS[0]);
  const rows = nonArchived.flatMap((stage) => arr(stage.tasks).map((task, index) => ({ stage, task, index })));
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><CardTitle>مهام توثيق وصيانة الآلية</CardTitle><p className="mt-1 text-xs text-muted">مهام إسناد عمل داعم للمرحلة (توثيق، مراجعة، نماذج، مسؤوليات) — لا تمثل لوحة Kanban أو نظام إدارة مشاريع بديل. تظهر في «مهامي» بعد الحفظ وتفتح مساحة هذه المرحلة مباشرة.</p></div>
          {canEdit && nonArchived.length ? (
            <div className="flex flex-wrap items-center gap-2">
              <select value={stageId} onChange={(event) => setStageId(event.target.value)} className="h-9 rounded-lg border bg-transparent px-2 text-xs">{nonArchived.map((s) => <option key={String(s.id)} value={String(s.id)}>{String(s.name)}</option>)}</select>
              <select value={preset} onChange={(event) => setPreset(event.target.value)} className="h-9 rounded-lg border bg-transparent px-2 text-xs">{TASK_PRESETS.map((item) => <option key={item} value={item}>{item}</option>)}</select>
              <Button size="sm" onClick={() => addStageRecord(stageId, "tasks", { id: newId("task"), title: preset, description: "", assignedUserId: "", assignee: "", priority: "MEDIUM", assignedAt: new Date().toISOString().slice(0, 10), dueDate: "", status: "NOT_STARTED", nextAction: "فتح مساحة المرحلة" })}><Plus className="h-4 w-4" />إضافة مهمة</Button>
            </div>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.map(({ stage, task, index }) => (
          <div key={String(task.id)} id={`task-${String(task.id)}`} className="grid gap-3 rounded-xl border p-4 md:grid-cols-5">
            <p className="text-xs font-semibold text-muted md:col-span-5">المرحلة: {String(stage.name)}</p>
            <Text label="المهمة" value={task.title} required onChange={(v) => patchStageRecord(String(stage.id), "tasks", index, { title: v })} />
            <label className="text-xs font-semibold">مستخدم المنصة<select disabled={!canEdit} value={String(task.assignedUserId || "")} onChange={(event) => { const user = users.find((item) => item.id === event.target.value); patchStageRecord(String(stage.id), "tasks", index, { assignedUserId: event.target.value, assignee: user?.name || task.assignee }); }} className="mt-1 h-9 w-full rounded-lg border bg-transparent px-3 text-xs"><option value="">مسؤول نصي فقط</option>{users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></label>
            <Text label="الموعد النهائي" type="date" value={task.dueDate} onChange={(v) => patchStageRecord(String(stage.id), "tasks", index, { dueDate: v })} />
            <Select label="الحالة" value={task.status} values={Object.keys(TASK_STATUS_LABELS)} onChange={(v) => patchStageRecord(String(stage.id), "tasks", index, { status: v, completedAt: v === "COMPLETED" ? new Date().toISOString() : null })} />
            <div className="md:col-span-5"><Text label="الوصف/الملاحظات" value={task.description} area onChange={(v) => patchStageRecord(String(stage.id), "tasks", index, { description: v })} /></div>
          </div>
        ))}
        {!rows.length ? <p className="rounded-lg border border-dashed p-6 text-center text-xs text-muted">لا توجد مهام بعد.</p> : null}
      </CardContent>
    </Card>
  );
}

function TraceTab({ trace, stages, initiativeOptions, update }: { trace: Row[]; stages: Row[]; initiativeOptions: InitiativeOption[]; update: (rows: Row[]) => void }) {
  const canEdit = useContext(EditContext);
  const [initiativeId, setInitiativeId] = useState("");
  const [stageId, setStageId] = useState("");
  const nonArchived = stages.filter((s) => !s.archived);
  function addTrace() {
    const initiative = initiativeOptions.find((i) => i.id === initiativeId); const stage = nonArchived.find((s) => s.id === stageId);
    if (!initiative || !stage) return;
    update([...trace, { id: newId("trace"), initiativeId: initiative.id, initiativeName: initiative.name, stageId: stage.id, stageName: stage.name, updatedDate: new Date().toISOString().slice(0, 10) }]);
  }
  return (
    <Card>
      <CardHeader><CardTitle>مسار مرجعي توضيحي</CardTitle><p className="mt-1 text-xs text-muted">توضيح سياقي لكيفية مرور مبادرة قائمة عبر مراحل الآلية — وليس تتبعًا لتنفيذ مشروع كامل. المبادرات مُعاد استخدامها من المتطلب 5.23.1.2 دون إنشاء مبادرات مكررة.</p></CardHeader>
      <CardContent className="space-y-3">
        {canEdit ? (
          <div className="flex flex-wrap items-end gap-2 rounded-xl border p-3">
            <label className="text-xs font-semibold">المبادرة الموجودة<select value={initiativeId} onChange={(event) => setInitiativeId(event.target.value)} className="mt-1 h-9 w-56 rounded-lg border bg-transparent px-2 text-xs"><option value="">اختر مبادرة</option>{initiativeOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label className="text-xs font-semibold">المرحلة الحالية<select value={stageId} onChange={(event) => setStageId(event.target.value)} className="mt-1 h-9 w-48 rounded-lg border bg-transparent px-2 text-xs"><option value="">اختر مرحلة</option>{nonArchived.map((item) => <option key={String(item.id)} value={String(item.id)}>{String(item.name)}</option>)}</select></label>
            <Button size="sm" onClick={addTrace} disabled={!initiativeId || !stageId}><Plus className="h-4 w-4" />إضافة</Button>
          </div>
        ) : null}
        {trace.map((row) => (
          <div key={String(row.id)} className="flex flex-wrap items-center gap-2 rounded-lg border p-3 text-xs">
            <Badge variant="primary">{String(row.initiativeName)}</Badge><ArrowLeft className="h-3.5 w-3.5 rotate-180" /><Badge variant="neutral">{String(row.stageName)}</Badge>
            <span className="text-muted">آخر تحديث: {String(row.updatedDate || "—")}</span>
          </div>
        ))}
        {!trace.length ? <p className="rounded-lg border border-dashed p-6 text-center text-xs text-muted">لا يوجد مسار مرجعي موثّق بعد — اختياري.</p> : null}
      </CardContent>
    </Card>
  );
}

function EvidenceApprovalTab({ current, stages, evidence, versions }: { current: Row; stages: Row[]; evidence: EvidenceRow[]; versions: Row[] }) {
  const relatedEvidence = evidence.filter((item) => item.relatedRecord === current.name);
  const nonArchived = stages.filter((s) => !s.archived);
  const checks: [string, boolean][] = [
    ["بيانات الآلية موثّقة (الاسم والوصف والمالك)", Boolean(String(current.name || "").trim() && String(current.description || "").trim() && String(current.owner || "").trim())],
    ["مراحل خارطة الرحلة موثّقة", nonArchived.length > 0],
    ["مسؤوليات محددة لكل مرحلة نشطة", nonArchived.every((s) => String(s.owner || "").trim() && String(s.responsibleRole || "").trim())],
    ["بوابات قرار معرّفة", nonArchived.every((s) => String(gateOf(s).owner || "").trim())],
    ["حالة الاعتماد الحالية: معتمد", current.approvalStatus === "معتمد"],
    ["دليل رسمي مرفوع", relatedEvidence.length > 0],
    ["دليل رسمي معتمد", relatedEvidence.some((item) => item.reviewStatus === "APPROVED")],
  ];
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>الأدلة واعتماد الآلية</CardTitle><p className="mt-1 text-xs text-muted">وجود واجهة خارطة الرحلة لا يمثّل بحد ذاته امتثالًا — الاعتماد الرسمي يُبنى على البيانات الفعلية والدليل المعتمد.</p></CardHeader>
        <CardContent className="space-y-2">
          {checks.map(([label, done]) => <p key={label} className="flex items-center gap-2 rounded-lg border p-3 text-sm">{done ? <CheckCircle2 className="h-4 w-4 text-success" /> : <AlertTriangle className="h-4 w-4 text-warning" />}{label}<Badge className="mr-auto" variant={done ? "success" : "warning"}>{done ? "مكتمل" : "ناقص"}</Badge></p>)}
          {relatedEvidence.map((item) => <div key={item.id} className="rounded-lg border p-3 text-xs"><b>{item.classification}</b> · {item.reviewStatus}</div>)}
          <p className="mt-3 text-xs text-muted">الاعتماد داخل المنصة توثيق تشغيلي ولا يمثل اعتمادًا رسميًا من هيئة الحكومة الرقمية.</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>سجل إصدارات الآلية</CardTitle><p className="mt-1 text-xs text-muted">تبقى الإصدارات السابقة قابلة للقراءة بعد اعتماد إصدار جديد، دون فقدان تتبعها.</p></CardHeader>
        <CardContent className="space-y-2">
          {[...versions].reverse().map((v) => (
            <div key={String(v.id)} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-xs">
              <span><b>{String(v.name)}</b> · الإصدار {String(v.version)}</span>
              <Badge variant={v.approvalStatus === "معتمد" ? "success" : v.approvalStatus === "تم الاستبدال" ? "neutral" : "warning"}>{String(v.approvalStatus)}</Badge>
              <span className="text-muted">{String(v.effectiveDate || "—")}</span>
            </div>
          ))}
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
