import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest, type NextResponse } from "next/server";

import middleware from "@/middleware";

const previousMode = process.env.UX_PREVIEW_MODE;
const previousVercelEnv = process.env.VERCEL_ENV;

beforeEach(() => { process.env.UX_PREVIEW_MODE = "true"; process.env.VERCEL_ENV = "preview"; });
afterEach(() => { process.env.UX_PREVIEW_MODE = previousMode; process.env.VERCEL_ENV = previousVercelEnv; });

describe("preview persona URL authority middleware", () => {
  it("initializes a missing persona exactly once from the documented default", async () => {
    const request = new NextRequest("https://preview.local/reports");
    const response = await middleware(request) as NextResponse;
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://preview.local/reports?previewRole=internal");
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("uses an explicit persona directly as the sole source of truth", async () => {
    const request = new NextRequest("https://preview.local/reports?previewRole=viewer");
    const response = await middleware(request) as NextResponse;
    expect(response.headers.get("x-middleware-rewrite")).toContain("/ux-preview?path=%2Freports&role=viewer");
    expect(response.headers.get("x-middleware-rewrite")).toContain("previewRole=viewer");
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("preserves partner on deep links and redirects restricted links coherently", async () => {
    const allowed = await middleware(new NextRequest("https://preview.local/strategy/requirements/5-23-1-r3?previewRole=partner")) as NextResponse;
    expect(allowed.headers.get("x-middleware-rewrite")).toContain("role=partner");
    const restricted = await middleware(new NextRequest("https://preview.local/reports?previewRole=partner")) as NextResponse;
    expect(restricted.headers.get("location")).toBe("https://preview.local/dashboard?previewRole=partner");
  });

  it("renders the internal rewrite target without recursively rewriting it", async () => {
    const response = await middleware(new NextRequest("https://preview.local/ux-preview?path=%2Fdashboard&role=admin&previewRole=admin")) as NextResponse;
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
  });
});
