import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest, type NextResponse } from "next/server";

import middleware from "@/middleware";

const previousMode = process.env.UX_PREVIEW_MODE;
const previousVercelEnv = process.env.VERCEL_ENV;

beforeEach(() => { process.env.UX_PREVIEW_MODE = "true"; process.env.VERCEL_ENV = "preview"; });
afterEach(() => { process.env.UX_PREVIEW_MODE = previousMode; process.env.VERCEL_ENV = previousVercelEnv; });

describe("preview persona persistence middleware", () => {
  it("restores viewer from the cookie when opening reports without a query", async () => {
    const request = new NextRequest("https://preview.local/reports", { headers: { cookie: "ux_preview_persona=viewer" } });
    const response = await middleware(request) as NextResponse;
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://preview.local/reports?previewRole=viewer");
  });

  it("records an explicit persona through a real redirect before rewriting", async () => {
    const request = new NextRequest("https://preview.local/reports?previewRole=viewer");
    const response = await middleware(request) as NextResponse;
    expect(response.status).toBe(307);
    expect(response.headers.get("set-cookie")).toContain("ux_preview_persona=viewer");
    const settled = await middleware(new NextRequest("https://preview.local/reports?previewRole=viewer", { headers: { cookie: "ux_preview_persona=viewer" } })) as NextResponse;
    expect(settled.headers.get("x-middleware-rewrite")).toContain("/ux-preview?path=%2Freports&role=viewer");
    expect(settled.headers.get("x-middleware-rewrite")).toContain("previewRole=viewer");
  });

  it("preserves partner on deep links and redirects restricted links coherently", async () => {
    const allowed = await middleware(new NextRequest("https://preview.local/evidence?previewRole=partner", { headers: { cookie: "ux_preview_persona=partner" } })) as NextResponse;
    expect(allowed.headers.get("x-middleware-rewrite")).toContain("role=partner");
    const restricted = await middleware(new NextRequest("https://preview.local/reports?previewRole=partner", { headers: { cookie: "ux_preview_persona=partner" } })) as NextResponse;
    expect(restricted.headers.get("location")).toBe("https://preview.local/dashboard?previewRole=partner");
  });
});
