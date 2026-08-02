import { NextResponse } from "next/server";

import { getAccessContext } from "@/server/authz";
import { isAuthorizationError } from "@/server/authorization";
import { prepareEvidenceDownload, auditDownloadDenied, EvidenceError } from "@/modules/evidence/service";

/**
 * Authorized evidence download.
 *
 * The caller supplies only the evidence id — never a storage key. Authorization
 * runs first; only then is a short-lived signed URL minted (when the provider
 * supports it and it is enabled) or the bytes streamed back through the server.
 * Responses are marked private/no-store so nothing is cached by a shared proxy.
 */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const ctx = await getAccessContext();
  if (!ctx) return new NextResponse("Unauthorized", { status: 401 });

  try {
    const plan = await prepareEvidenceDownload(ctx, params.id);

    if (plan.mode === "redirect") {
      const res = NextResponse.redirect(plan.url, 302);
      res.headers.set("Cache-Control", "private, no-store");
      return res;
    }

    return new NextResponse(new Uint8Array(plan.body), {
      status: 200,
      headers: {
        "Content-Type": plan.mimeType,
        "Content-Length": String(plan.body.length),
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(plan.fileName)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    if (isAuthorizationError(e)) {
      await auditDownloadDenied(ctx.userId, params.id, e.code);
      // Do not distinguish "exists but forbidden" from "not found" to the client.
      return new NextResponse("Not found", { status: 404 });
    }
    if (e instanceof EvidenceError) {
      if (e.code === "NOT_FOUND" || e.code === "NO_BINARY") {
        await auditDownloadDenied(ctx.userId, params.id, e.code);
        return new NextResponse("Not found", { status: 404 });
      }
      return new NextResponse("Storage error", { status: 502 });
    }
    throw e;
  }
}
