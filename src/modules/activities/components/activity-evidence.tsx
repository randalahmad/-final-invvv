"use client";

import { useFormState, useFormStatus } from "react-dom";
import { AlertCircle, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { uploadActivityEvidenceAction, type EvidenceFormState } from "@/modules/evidence/actions";
import { archiveEvidenceAction, type EvidenceActionState } from "@/modules/evidence/actions";
import { REVIEW_STATUS_LABELS, FILE_STATUS_LABELS } from "@/modules/evidence/schema";

const fieldClass =
  "w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-border-dark dark:bg-surface-dark";

const REVIEW_VARIANT: Record<string, "neutral" | "primary" | "success" | "warning" | "danger"> = {
  DRAFT: "neutral",
  SUBMITTED: "primary",
  UNDER_REVIEW: "warning",
  APPROVED: "success",
  REJECTED: "danger",
  ARCHIVED: "neutral",
};

function formatSize(bytes: number | null): string {
  if (!bytes || bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      <Upload className="h-4 w-4" />
      {pending ? "جارٍ الرفع…" : "رفع شاهد"}
    </Button>
  );
}

export function ActivityEvidenceUploadForm({ activityId }: { activityId: string }) {
  const [state, formAction] = useFormState<EvidenceFormState, FormData>(uploadActivityEvidenceAction, {});
  const fe = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {state.error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl bg-danger-bg px-3.5 py-2.5 text-sm text-danger">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {state.error}
        </div>
      )}
      <input type="hidden" name="activityId" value={activityId} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="title">عنوان الشاهد</Label>
          <Input id="title" name="title" required placeholder="مثال: صور توثيق الورشة" />
          <p className="text-[11.5px] text-danger">{fe.title?.[0]}</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="classification">تصنيف الشاهد (اختياري)</Label>
          <Input id="classification" name="classification" placeholder="مثال: PHOTO, ATTENDANCE_SHEET" />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="description">الوصف</Label>
          <textarea id="description" name="description" rows={2} className={fieldClass} placeholder="وصف مختصر" />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="file">الملف</Label>
          <input
            id="file"
            name="file"
            type="file"
            required
            accept=".pdf,.docx,.xlsx,.jpg,.jpeg,.png,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,image/jpeg,image/png"
            className={fieldClass}
          />
        </div>
      </div>
      <div>
        <SubmitButton />
      </div>
    </form>
  );
}

export interface ActivityEvidenceRow {
  id: string;
  title: string;
  fileName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  reviewStatus: string;
  fileProcessingStatus: string;
  classification: string | null;
  createdAt: Date;
  archivedAt: Date | null;
  uploadedBy: { name: string } | null;
}

function ArchiveEvidenceButton({ evidenceId }: { evidenceId: string }) {
  const [state, formAction] = useFormState<EvidenceActionState, FormData>(archiveEvidenceAction, {});
  return (
    <div className="flex flex-col items-end gap-1">
      <form
        action={formAction}
        onSubmit={(e) => {
          if (!confirm("هل تريد أرشفة هذا الشاهد؟")) e.preventDefault();
        }}
      >
        <input type="hidden" name="evidenceId" value={evidenceId} />
        <Button type="submit" size="sm" variant="outline">
          أرشفة
        </Button>
      </form>
      {state.error && (
        <span role="alert" className="text-[11px] text-danger">
          {state.error}
        </span>
      )}
    </div>
  );
}

export function ActivityEvidenceList({ rows, canArchive }: { rows: ActivityEvidenceRow[]; canArchive: boolean }) {
  if (rows.length === 0) {
    return <p className="text-[12.5px] text-muted">لا توجد شواهد مرفوعة لهذا النشاط بعد.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-start">
        <thead>
          <tr className="border-b border-border text-[11.5px] text-muted dark:border-border-dark">
            <th className="px-3 py-2 text-start font-medium">العنوان</th>
            <th className="px-3 py-2 text-start font-medium">حالة المراجعة</th>
            <th className="px-3 py-2 text-start font-medium">الملف</th>
            <th className="px-3 py-2 text-start font-medium">الحجم</th>
            <th className="px-3 py-2 text-start font-medium">رفعه</th>
            <th className="px-3 py-2 text-start font-medium">تاريخ الرفع</th>
            {canArchive && <th className="px-3 py-2 text-start font-medium">إجراء</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-border/60 last:border-0 dark:border-border-dark/60">
              <td className="px-3 py-2 text-[12.5px]">
                <span className="font-semibold text-slate-800 dark:text-slate-100">{r.title}</span>
                {r.classification && <div className="mt-0.5 text-[11px] text-muted">{r.classification}</div>}
              </td>
              <td className="px-3 py-2">
                <Badge variant={REVIEW_VARIANT[r.reviewStatus] ?? "neutral"}>{REVIEW_STATUS_LABELS[r.reviewStatus] ?? r.reviewStatus}</Badge>
              </td>
              <td className="px-3 py-2 text-[12px] text-muted">
                {r.fileName ?? "—"}
                <div className="text-[11px]">{FILE_STATUS_LABELS[r.fileProcessingStatus] ?? r.fileProcessingStatus}</div>
              </td>
              <td className="px-3 py-2 text-[12px] text-muted">{formatSize(r.sizeBytes)}</td>
              <td className="px-3 py-2 text-[12px] text-muted">{r.uploadedBy?.name ?? "—"}</td>
              <td className="px-3 py-2 text-[12px] text-muted">{new Date(r.createdAt).toLocaleDateString("ar")}</td>
              {canArchive && <td className="px-3 py-2">{!r.archivedAt && <ArchiveEvidenceButton evidenceId={r.id} />}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
