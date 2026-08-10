import { getLiveReadiness } from "@/modules/dga/live-readiness";
import { can, getAccessContext } from "@/server/authz";

function csvCell(value: unknown) { return `"${String(value ?? "").replaceAll('"', '""')}"`; }
export async function GET() {
  const actor = await getAccessContext();
  if (!actor || !can(actor, "compliance.export")) return new Response("Forbidden", { status: 403 });
  const data = await getLiveReadiness(actor);
  const rows = [["الوحدة","الاسم","الجاهزية","المكتمل","الإجمالي","الأدلة الناقصة","المتأخر","آخر تحديث"], ...data.units.map(unit => [unit.code,unit.name,unit.readiness,unit.completed,unit.total,unit.missingEvidence,unit.overdue,unit.latestUpdate ?? ""])];
  const body = `\uFEFF${rows.map(row=>row.map(csvCell).join(",")).join("\r\n")}`;
  return new Response(body,{headers:{"content-type":"text/csv; charset=utf-8","content-disposition":"attachment; filename=innovation-readiness.csv","cache-control":"no-store"}});
}
