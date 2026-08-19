import { afterEach, describe, expect, it } from "vitest";

import { isUxPreviewMode, resolveRuntimeModes } from "@/lib/ux-preview";

const originalMode = process.env.UX_PREVIEW_MODE;
const originalVercelEnv = process.env.VERCEL_ENV;

afterEach(() => {
  process.env.UX_PREVIEW_MODE = originalMode;
  process.env.VERCEL_ENV = originalVercelEnv;
});

describe("UX preview safety gate", () => {
  it("activates only with the explicit flag outside production", () => {
    process.env.UX_PREVIEW_MODE = "true";
    process.env.VERCEL_ENV = "preview";
    expect(isUxPreviewMode()).toBe(true);
  });

  it("never activates in Vercel production", () => {
    process.env.UX_PREVIEW_MODE = "true";
    process.env.VERCEL_ENV = "production";
    expect(isUxPreviewMode()).toBe(false);
  });

  it("stays disabled without the exact flag", () => {
    process.env.UX_PREVIEW_MODE = "false";
    process.env.VERCEL_ENV = "preview";
    expect(isUxPreviewMode()).toBe(false);
  });
});

describe("runtime mode precedence", () => {
  it("makes UX Preview authoritative over Demo in a Vercel Preview", () => {
    expect(resolveRuntimeModes({ UX_PREVIEW_MODE: "true", DEMO_MODE: "true", VERCEL_ENV: "preview", NODE_ENV: "production" })).toEqual({ uxPreview: true, demo: false, production: false });
  });

  it("allows implicit database-free Demo only in local development", () => {
    expect(resolveRuntimeModes({ NODE_ENV: "development" }).demo).toBe(true);
  });

  it("never enables Demo in Vercel Production", () => {
    expect(resolveRuntimeModes({ VERCEL_ENV: "production", NODE_ENV: "production", DEMO_MODE: "true" })).toEqual({ uxPreview: false, demo: false, production: true });
  });

  it("never uses missing DATABASE_URL as a self-hosted Production fallback", () => {
    expect(resolveRuntimeModes({ NODE_ENV: "production" })).toEqual({ uxPreview: false, demo: false, production: true });
  });
});
