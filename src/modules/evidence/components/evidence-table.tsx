import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { REVIEW_STATUS_LABELS, FILE_STATUS_LABELS } from "@/modules/evidence/schema";

export interface EvidenceRow {
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

export function EvidenceTable({ rows, solutionId }: { rows: EvidenceRow[]; solutionId: string }) {
  if (rows.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center gap-2 px-6 py-14 text-center">
          <p className="text-sm text-muted">لا توجد أدلة مطابقة لهذا الحل.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-start">
            <thead>
              <tr className="border-b border-border text-[11.5px] text-muted dark:border-border-dark">
                <th className="px-4 py-2.5 text-start font-medium">العنوان</th>
                <th className="px-4 py-2.5 text-start font-medium">حالة المراجعة</th>
                <th className="px-4 py-2.5 text-start font-medium">حالة الملف</th>
                <th className="px-4 py-2.5 text-start font-medium">الملف</th>
                <th className="px-4 py-2.5 text-start font-medium">الحجم</th>
                <th className="px-4 py-2.5 text-start font-medium">رفعه</th>
                <th className="px-4 py-2.5 text-start font-medium">تاريخ الرفع</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-border/60 last:border-0 hover:bg-slate-50/60 dark:border-border-dark/60 dark:hover:bg-white/5"
                >
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/solutions/${solutionId}/evidence/${r.id}`}
                      className="text-[13px] font-semibold text-primary hover:underline"
                    >
                      {r.title}
                    </Link>
                    {r.classification && <div className="mt-0.5 text-[11px] text-muted">{r.classification}</div>}
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge variant={REVIEW_VARIANT[r.reviewStatus] ?? "neutral"}>
                      {REVIEW_STATUS_LABELS[r.reviewStatus] ?? r.reviewStatus}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 text-[12px] text-muted">
                    {FILE_STATUS_LABELS[r.fileProcessingStatus] ?? r.fileProcessingStatus}
                  </td>
                  <td className="px-4 py-2.5 text-[12px] text-muted">{r.fileName ?? "—"}</td>
                  <td className="px-4 py-2.5 text-[12px] text-muted">{formatSize(r.sizeBytes)}</td>
                  <td className="px-4 py-2.5 text-[12px] text-muted">{r.uploadedBy?.name ?? "—"}</td>
                  <td className="px-4 py-2.5 text-[12px] text-muted">{new Date(r.createdAt).toLocaleDateString("ar")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
