import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { evidenceMatrix } from "@/modules/governance-workflow/evidence-matrix-service";
import { requireUser } from "@/server/authz";

export const metadata = { title: "مستودع الأدلة" };

const REVIEW_LABELS: Record<string, string> = {
  DRAFT: "مسودة", SUBMITTED: "مُقدَّم", UNDER_REVIEW: "قيد المراجعة", NEEDS_AMENDMENT: "يحتاج تعديلًا",
  PENDING_APPROVAL: "بانتظار الاعتماد", APPROVED: "معتمد", NEEDS_UPDATE: "يحتاج تحديثًا", REJECTED: "مرفوض", ARCHIVED: "مؤرشف", MISSING: "غير موجود",
};

export default async function EvidenceRepositoryPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const actor = await requireUser();
  // Reuses the exact same scoped, real data as /evidence-matrix — this page only
  // changes the lens (browsing existing evidence records) rather than the source.
  const allRows = await evidenceMatrix(actor);
  let rows = allRows.filter((r) => r.evidenceId); // repository = actually-existing evidence, not gaps

  if (searchParams.q?.trim()) {
    const q = searchParams.q.trim().toLowerCase();
    rows = rows.filter((r) => r.title.toLowerCase().includes(q) || (r.fileName ?? "").toLowerCase().includes(q));
  }
  if (searchParams.status) rows = rows.filter((r) => r.reviewStatus === searchParams.status);
  if (searchParams.unit) rows = rows.filter((r) => r.code.startsWith(searchParams.unit!));
  if (searchParams.needsUpdate === "1") rows = rows.filter((r) => r.needsUpdate);

  const statuses = [...new Set(rows.map((r) => r.reviewStatus))];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="مستودع الأدلة"
        description={`عرض مركزي حي لكل الأدلة الموجودة فعليًا (${rows.length} من أصل ${allRows.filter((r) => r.evidenceId).length}) عبر معياري 5.23 و5.24 — نفس بيانات مصفوفة الأدلة، بعدسة تصفح بدل عدسة الفجوات.`}
      />

      <form className="flex flex-wrap gap-2">
        <input name="q" defaultValue={searchParams.q} placeholder="بحث بالعنوان أو اسم الملف" className="min-w-[220px] rounded-lg border bg-transparent p-2 text-xs" />
        <input name="unit" defaultValue={searchParams.unit} placeholder="المعيار (مثال 5.23 أو 5.24.1)" className="rounded-lg border bg-transparent p-2 text-xs" />
        <select name="status" defaultValue={searchParams.status} className="rounded-lg border bg-transparent p-2 text-xs">
          <option value="">كل حالات المراجعة</option>
          {statuses.map((s) => <option key={s} value={s}>{REVIEW_LABELS[s] ?? s}</option>)}
        </select>
        <label className="flex items-center gap-1 text-xs">
          <input type="checkbox" name="needsUpdate" value="1" defaultChecked={searchParams.needsUpdate === "1"} /> يحتاج تحديثًا فقط
        </label>
        <button className="rounded-lg border px-3 text-xs">تطبيق</button>
      </form>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px] text-xs">
              <thead>
                <tr className="border-b">
                  {["المعيار/المتطلب", "اسم الملف", "النسخة", "المالك", "الإدارة", "تاريخ الرفع", "المراجعة", "الاعتماد", "الصلاحية", "فتح"].map((h) => (
                    <th key={h} className="p-3 text-start">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={`${row.evidenceId}-${i}`} className="border-b">
                    <td className="p-3">
                      <Link className="text-primary" href={row.href}>{row.code} — {row.title}</Link>
                    </td>
                    <td className="p-3">{row.fileName ?? "—"}</td>
                    <td className="p-3">{row.version ?? "—"}</td>
                    <td className="p-3">{row.owner}</td>
                    <td className="p-3">{row.department}</td>
                    <td className="p-3">{row.date ? new Date(row.date).toLocaleDateString("ar-SA") : "—"}</td>
                    <td className="p-3"><Badge variant={row.reviewStatus === "APPROVED" ? "success" : row.reviewStatus === "REJECTED" ? "danger" : "neutral"}>{REVIEW_LABELS[row.reviewStatus] ?? row.reviewStatus}</Badge></td>
                    <td className="p-3">{row.approvalStatus === "APPROVED" ? "معتمد" : "غير معتمد"}</td>
                    <td className="p-3">{row.needsUpdate ? <Badge variant="warning">يحتاج تحديث</Badge> : <Badge variant="success">ساري</Badge>}</td>
                    <td className="p-3"><Link className="text-primary" href={row.href}>عرض</Link></td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr><td colSpan={10} className="p-6 text-center text-muted">لا توجد أدلة مطابقة لعوامل التصفية ضمن نطاقك.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
