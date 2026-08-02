import { NextResponse } from "next/server";

import { getAccessContext } from "@/server/authz";
import { isAuthorizationError } from "@/server/authorization";
import { writeAudit, AUDIT } from "@/server/audit";
import { getComplianceFile, ComplianceError } from "@/modules/compliance/service";
import { buildComplianceCsv, exportFileName } from "@/modules/compliance/export";

/**
 * Basic CSV export of a solution's compliance file (mvp-scope.md §2.7). Requires
 * `compliance.export`; the export attempt is audited (COMPLIANCE_EXPORTED). The
 * bundled official ZIP package remains out of MVP scope.
 */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const ctx = await getAccessContext();
  if (!ctx) return new NextResponse("Unauthorized", { status: 401 });
  if (!ctx.permissions.has("compliance.export")) return new NextResponse("Not found", { status: 404 });

  try {
    // getComplianceFile enforces compliance.view + internal scope; export layers
    // the additional compliance.export permission checked above.
    const file = await getComplianceFile(ctx, params.id);
    const csv = buildComplianceCsv(file);

    await writeAudit({
      actorUserId: ctx.userId,
      action: AUDIT.COMPLIANCE_EXPORTED,
      entityType: "INNOVATION_SOLUTION",
      entityId: params.id,
      summary: "تصدير ملف الامتثال (CSV)",
      metadata: { format: "csv", overallReadiness: file.overallReadiness },
    });

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(exportFileName(file))}`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    if (e instanceof ComplianceError && (e.code === "NOT_FOUND" || e.code === "NOT_INTERNAL")) {
      return new NextResponse("Not found", { status: 404 });
    }
    if (isAuthorizationError(e)) return new NextResponse("Not found", { status: 404 });
    throw e;
  }
}
