import { afterEach, describe, expect, it } from "vitest";

import { isUxPreviewMode } from "@/lib/ux-preview";

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
