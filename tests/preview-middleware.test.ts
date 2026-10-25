import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest, type NextResponse } from "next/server";

import middleware from "@/middleware";
import { UX_PREVIEW_ACCOUNTS, UX_PREVIEW_SESSION_COOKIE } from "@/server/ux-preview-accounts";

const previousMode = process.env.UX_PREVIEW_MODE;
const previousVercelEnv = process.env.VERCEL_ENV;

beforeEach(() => { process.env.UX_PREVIEW_MODE = "true"; process.env.VERCEL_ENV = "preview"; });
afterEach(() => { process.env.UX_PREVIEW_MODE = previousMode; process.env.VERCEL_ENV = previousVercelEnv; });

function requestFor(path: string, persona: "admin" | "internal" | "innovator" | "partner" | "viewer") {
  const account = UX_PREVIEW_ACCOUNTS.find((item) => item.persona === persona)!;
  return new NextRequest(`https://preview.local${path}`, { headers: { cookie: `${UX_PREVIEW_SESSION_COOKIE}=${account.token}` } });
}

describe("preview authenticated account middleware", () => {
  it("allows the preview-only readiness API to reach its own safety gate", async () => {
    const response = await middleware(new NextRequest("https://preview.local/api/ux-preview/idea-readiness", { method: "POST" })) as NextResponse;
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
  });
  it("allows the preview-only idea ranking API to reach its own safety gate", async () => {
    const response = await middleware(new NextRequest("https://preview.local/api/ux-preview/idea-ranking", { method: "POST" })) as NextResponse;
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
  });
  it("redirects unauthenticated app requests to preview login", async () => {
    const request = new NextRequest("https://preview.local/reports");
    const response = await middleware(request) as NextResponse;
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://preview.local/login?callbackUrl=%2Freports");
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("uses the authenticated account as the sole source of truth", async () => {
    const request = requestFor("/reports?previewRole=admin", "viewer");
    const response = await middleware(request) as NextResponse;
    expect(response.headers.get("location")).toBe("https://preview.local/reports?previewRole=viewer");
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("preserves partner on deep links and redirects restricted links coherently", async () => {
    const allowed = await middleware(requestFor("/strategy/requirements/5-23-1-r3?previewRole=partner", "partner")) as NextResponse;
    expect(allowed.headers.get("x-middleware-rewrite")).toContain("role=partner");
    const restricted = await middleware(requestFor("/reports?previewRole=partner", "partner")) as NextResponse;
    expect(restricted.headers.get("location")).toBe("https://preview.local/dashboard?previewRole=partner");
  });

  it("sends an authenticated innovator to the innovator journey", async () => {
    const response = await middleware(requestFor("/", "innovator")) as NextResponse;
    expect(response.headers.get("location")).toBe("https://preview.local/journey?previewRole=innovator");
  });

  it("renders the internal rewrite target without recursively rewriting it", async () => {
    const response = await middleware(new NextRequest("https://preview.local/ux-preview?path=%2Fdashboard&role=admin&previewRole=admin")) as NextResponse;
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
  });
});
