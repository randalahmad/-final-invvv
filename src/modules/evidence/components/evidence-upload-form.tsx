"use client";

import { useFormState, useFormStatus } from "react-dom";
import { AlertCircle, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { uploadEvidenceAction, type EvidenceFormState } from "@/modules/evidence/actions";

const fieldClass =
  "w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-border-dark dark:bg-surface-dark";

function FieldError({ errors }: { errors?: string[] }) {
  return errors?.length ? <p className="text-[11.5px] text-danger">{errors[0]}</p> : null;
}
function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      <Upload className="h-4 w-4" />
      {pending ? "جارٍ الرفع…" : "رفع الدليل"}
    </Button>
  );
}

export function EvidenceUploadForm({ solutionId }: { solutionId: string }) {
  const [state, formAction] = useFormState<EvidenceFormState, FormData>(uploadEvidenceAction, {});
  const fe = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-4">
      {state.error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl bg-danger-bg px-3.5 py-2.5 text-sm text-danger">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {state.error}
        </div>
      )}
      <input type="hidden" name="solutionId" value={solutionId} />

      <div className="flex flex-col gap-2">
        <Label htmlFor="title">عنوان الدليل</Label>
        <Input id="title" name="title" required placeholder="مثال: محضر اعتماد اللجنة" />
        <FieldError errors={fe.title} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="description">الوصف</Label>
        <textarea id="description" name="description" rows={3} className={fieldClass} placeholder="وصف مختصر لمحتوى الدليل" />
        <FieldError errors={fe.description} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="classification">تصنيف الدليل (اختياري)</Label>
        <Input id="classification" name="classification" placeholder="مثال: محضر اعتماد أو تقرير قياس أثر" />
        <p className="text-[11px] text-muted">يساعد التصنيف في مطابقة الوثيقة مع متطلبات الأدلة.</p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="file">الملف</Label>
        <input
          id="file"
          name="file"
          type="file"
          required
          accept=".pdf,.docx,.xlsx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className={fieldClass}
        />
        <p className="text-[11px] text-muted">الأنواع المدعومة: PDF، DOCX، XLSX — بحد أقصى 25 ميغابايت.</p>
      </div>

      <div>
        <SubmitButton />
      </div>
    </form>
  );
}
