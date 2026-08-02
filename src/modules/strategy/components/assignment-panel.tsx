"use client";

import { useFormState, useFormStatus } from "react-dom";
import { AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  createAssignmentAction,
  updateAssignmentAction,
  archiveAssignmentAction,
  uploadStrategyDocumentAction,
  updateStrategyDocumentAction,
  archiveStrategyDocumentAction,
  type StrategyFormState,
  type StrategyActionState,
} from "@/modules/strategy/actions";
import { ASSIGNMENT_STATUS_LABELS, DOCUMENT_APPROVAL_STATUS_LABELS } from "@/modules/strategy/schema";
import type { AssignmentRow } from "@/modules/strategy/service";

const fieldClass =
  "w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-border-dark dark:bg-surface-dark";

const STATUS_VARIANT: Record<string, "success" | "neutral" | "warning"> = {
  FULFILLED: "success",
  IN_PROGRESS: "warning",
  NOT_STARTED: "neutral",
};

function FieldError({ errors }: { errors?: string[] }) {
  return errors?.length ? <p className="text-[11.5px] text-danger">{errors[0]}</p> : null;
}
function Pending({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <>{pending ? "…" : label}</>;
}

export function AssignmentForm({
  objectiveId,
  requirements,
  departments,
}: {
  objectiveId: string;
  requirements: { id: string; label: string }[];
  departments: { id: string; label: string }[];
}) {
  const [state, formAction] = useFormState<StrategyFormState, FormData>(createAssignmentAction, {});
  const fe = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-2xl border border-dashed border-border p-4 dark:border-border-dark">
      {state.error && (
        <div role="alert" className="flex items-center gap-2 rounded-xl bg-danger-bg px-3.5 py-2.5 text-sm text-danger">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {state.error}
        </div>
      )}
      <input type="hidden" name="objectiveId" value={objectiveId} />
      <input type="hidden" name="strategicObjectiveId" value={objectiveId} />
      <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">إسناد معيار امتثال لجهة</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="complianceRequirementId">المعيار</Label>
          <select id="complianceRequirementId" name="complianceRequirementId" required className={fieldClass} defaultValue="">
            <option value="" disabled>
              اختر المعيار…
            </option>
            {requirements.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
          <FieldError errors={fe.complianceRequirementId} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="departmentId">الجهة المسؤولة عن الاستيفاء</Label>
          <select id="departmentId" name="departmentId" required className={fieldClass} defaultValue="">
            <option value="" disabled>
              اختر الجهة…
            </option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
          <FieldError errors={fe.departmentId} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="dueDate">تاريخ الاستحقاق (اختياري)</Label>
          <Input id="dueDate" name="dueDate" type="date" />
        </div>
      </div>
      <div className="flex justify-end">
        <Button type="submit" size="sm">
          <Pending label="إسناد" />
        </Button>
      </div>
    </form>
  );
}

function EditDueDateForm({ objectiveId, assignmentId, dueDate }: { objectiveId: string; assignmentId: string; dueDate: Date | null }) {
  const [state, formAction] = useFormState<StrategyActionState, FormData>(updateAssignmentAction, {});
  const day = dueDate ? new Date(dueDate).toISOString().slice(0, 10) : "";
  return (
    <form action={formAction} className="flex items-center gap-1.5">
      <input type="hidden" name="objectiveId" value={objectiveId} />
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <input
        type="date"
        name="dueDate"
        defaultValue={day}
        aria-label="تاريخ الاستحقاق"
        className="rounded-lg border border-border bg-surface px-2 py-1 text-[11.5px] outline-none dark:border-border-dark dark:bg-surface-dark"
      />
      <Button type="submit" size="sm" variant="outline">
        <Pending label="حفظ" />
      </Button>
      {state.error && (
        <span role="alert" className="text-[11px] text-danger">
          {state.error}
        </span>
      )}
    </form>
  );
}

function ArchiveAssignmentButton({ objectiveId, assignmentId }: { objectiveId: string; assignmentId: string }) {
  const [state, formAction] = useFormState<StrategyActionState, FormData>(archiveAssignmentAction, {});
  return (
    <div className="flex flex-col items-end gap-1">
      <form
        action={formAction}
        onSubmit={(e) => {
          if (!confirm("هل تريد أرشفة هذا الإسناد؟")) e.preventDefault();
        }}
      >
        <input type="hidden" name="objectiveId" value={objectiveId} />
        <input type="hidden" name="assignmentId" value={assignmentId} />
        <Button type="submit" size="sm" variant="outline">
          <Pending label="أرشفة الإسناد" />
        </Button>
      </form>
      {state.error && (
        <span role="alert" className="text-[11.5px] text-danger">
          {state.error}
        </span>
      )}
    </div>
  );
}

function UploadDocumentForm({ objectiveId, assignmentId }: { objectiveId: string; assignmentId: string }) {
  const [state, formAction] = useFormState<StrategyFormState, FormData>(uploadStrategyDocumentAction, {});
  const fe = state.fieldErrors ?? {};
  return (
    <form action={formAction} encType="multipart/form-data" className="flex flex-col gap-3">
      {state.error && (
        <div role="alert" className="flex items-center gap-2 rounded-xl bg-danger-bg px-3.5 py-2.5 text-sm text-danger">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {state.error}
        </div>
      )}
      <input type="hidden" name="objectiveId" value={objectiveId} />
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`titleAr-${assignmentId}`}>اسم الوثيقة</Label>
          <Input id={`titleAr-${assignmentId}`} name="titleAr" required />
          <FieldError errors={fe.titleAr} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`documentType-${assignmentId}`}>نوع الوثيقة</Label>
          <Input id={`documentType-${assignmentId}`} name="documentType" placeholder="مثال: خطة معتمدة" required />
          <FieldError errors={fe.documentType} />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor={`description-${assignmentId}`}>وصف مختصر</Label>
          <Input id={`description-${assignmentId}`} name="description" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`documentDate-${assignmentId}`}>تاريخ الوثيقة</Label>
          <Input id={`documentDate-${assignmentId}`} name="documentDate" type="date" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`approvalStatus-${assignmentId}`}>حالة الاعتماد</Label>
          <select id={`approvalStatus-${assignmentId}`} name="approvalStatus" defaultValue="DRAFT" className={fieldClass}>
            {Object.entries(DOCUMENT_APPROVAL_STATUS_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-muted">اختر &quot;معتمدة&quot; مباشرة إذا وصلت الوثيقة معتمدة أصلًا من خارج المنصة.</p>
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor={`file-${assignmentId}`}>ملف الوثيقة (الشاهد)</Label>
          <input id={`file-${assignmentId}`} name="file" type="file" accept=".pdf,.docx,.xlsx" className={fieldClass} />
        </div>
      </div>
      <div className="flex justify-end">
        <Button type="submit" size="sm">
          <Pending label="رفع الوثيقة" />
        </Button>
      </div>
    </form>
  );
}

function ArchiveDocumentButton({ objectiveId, documentId }: { objectiveId: string; documentId: string }) {
  const [state, formAction] = useFormState<StrategyActionState, FormData>(archiveStrategyDocumentAction, {});
  return (
    <div className="flex flex-col items-end gap-1">
      <form
        action={formAction}
        onSubmit={(e) => {
          if (!confirm("هل تريد أرشفة هذه الوثيقة؟ يمكن رفع وثيقة جديدة بعد الأرشفة.")) e.preventDefault();
        }}
      >
        <input type="hidden" name="objectiveId" value={objectiveId} />
        <input type="hidden" name="documentId" value={documentId} />
        <Button type="submit" size="sm" variant="outline">
          <Pending label="أرشفة الوثيقة" />
        </Button>
      </form>
      {state.error && (
        <span role="alert" className="text-[11.5px] text-danger">
          {state.error}
        </span>
      )}
    </div>
  );
}

function EditDocumentForm({
  objectiveId,
  document,
}: {
  objectiveId: string;
  document: { id: string; titleAr: string; documentType: string; description: string | null; documentDate: Date | null; approvalStatus: string; notes: string | null };
}) {
  const [state, formAction] = useFormState<StrategyFormState, FormData>(updateStrategyDocumentAction, {});
  const fe = state.fieldErrors ?? {};
  const day = document.documentDate ? new Date(document.documentDate).toISOString().slice(0, 10) : "";
  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-xl border border-border p-3 dark:border-border-dark">
      {state.error && (
        <div role="alert" className="flex items-center gap-2 rounded-xl bg-danger-bg px-3.5 py-2.5 text-sm text-danger">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {state.error}
        </div>
      )}
      <input type="hidden" name="objectiveId" value={objectiveId} />
      <input type="hidden" name="documentId" value={document.id} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`edit-titleAr-${document.id}`}>اسم الوثيقة</Label>
          <Input id={`edit-titleAr-${document.id}`} name="titleAr" required defaultValue={document.titleAr} />
          <FieldError errors={fe.titleAr} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`edit-documentType-${document.id}`}>نوع الوثيقة</Label>
          <Input id={`edit-documentType-${document.id}`} name="documentType" required defaultValue={document.documentType} />
          <FieldError errors={fe.documentType} />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor={`edit-description-${document.id}`}>وصف مختصر</Label>
          <Input id={`edit-description-${document.id}`} name="description" defaultValue={document.description ?? ""} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`edit-documentDate-${document.id}`}>تاريخ الوثيقة</Label>
          <Input id={`edit-documentDate-${document.id}`} name="documentDate" type="date" defaultValue={day} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`edit-approvalStatus-${document.id}`}>حالة الاعتماد</Label>
          <select id={`edit-approvalStatus-${document.id}`} name="approvalStatus" defaultValue={document.approvalStatus} className={fieldClass}>
            {Object.entries(DOCUMENT_APPROVAL_STATUS_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor={`edit-notes-${document.id}`}>ملاحظات</Label>
          <Input id={`edit-notes-${document.id}`} name="notes" defaultValue={document.notes ?? ""} />
        </div>
      </div>
      <div className="flex justify-end">
        <Button type="submit" size="sm">
          <Pending label="حفظ التعديلات" />
        </Button>
      </div>
    </form>
  );
}

export function AssignmentList({
  objectiveId,
  assignments,
  canManageAssignment,
  canUploadDocument,
  canManageDocument,
  canArchiveDocument,
}: {
  objectiveId: string;
  assignments: AssignmentRow[];
  canManageAssignment: boolean;
  canUploadDocument: boolean;
  canManageDocument: boolean;
  canArchiveDocument: boolean;
}) {
  if (assignments.length === 0) {
    return <p className="text-[12.5px] text-muted">لا توجد معايير مُسنَدة لهذا الهدف بعد.</p>;
  }
  return (
    <div className="flex flex-col gap-4">
      {assignments.map((a) => (
        <div key={a.id} className="rounded-2xl border border-border p-4 dark:border-border-dark">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[13.5px] font-semibold text-slate-800 dark:text-slate-100">
                {a.requirementCode ? `${a.requirementCode} — ${a.requirementTitleAr}` : a.requirementTitleAr}
              </p>
              <p className="mt-0.5 text-[12px] text-muted">الجهة: {a.departmentName ?? "—"}</p>
              {canManageAssignment ? (
                <div className="mt-1.5">
                  <EditDueDateForm objectiveId={objectiveId} assignmentId={a.id} dueDate={a.dueDate} />
                </div>
              ) : (
                a.dueDate && <p className="mt-0.5 text-[12px] text-muted">تاريخ الاستحقاق: {new Date(a.dueDate).toLocaleDateString("ar")}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={STATUS_VARIANT[a.status]}>{ASSIGNMENT_STATUS_LABELS[a.status]}</Badge>
              {canManageAssignment && <ArchiveAssignmentButton objectiveId={objectiveId} assignmentId={a.id} />}
            </div>
          </div>

          <div className="mt-4 border-t border-border pt-4 dark:border-border-dark">
            {a.document ? (
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-[12.5px] text-muted">
                    حالة الوثيقة: <Badge variant="neutral">{DOCUMENT_APPROVAL_STATUS_LABELS[a.document.approvalStatus] ?? a.document.approvalStatus}</Badge>{" "}
                    {a.document.hasEvidence ? "· شاهد مرفوع" : "· بلا شاهد بعد"}
                  </div>
                  {canArchiveDocument && <ArchiveDocumentButton objectiveId={objectiveId} documentId={a.document.id} />}
                </div>
                {canManageDocument && <EditDocumentForm objectiveId={objectiveId} document={a.document} />}
              </div>
            ) : canUploadDocument ? (
              <UploadDocumentForm objectiveId={objectiveId} assignmentId={a.id} />
            ) : (
              <p className="text-[12.5px] text-muted">لم تُرفع وثيقة بعد لهذا الإسناد.</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
