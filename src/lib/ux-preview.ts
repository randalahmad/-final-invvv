/** Explicit, non-production switch for stakeholder interface review. */
export function isUxPreviewMode(): boolean {
  return process.env.UX_PREVIEW_MODE === "true" && process.env.VERCEL_ENV !== "production";
}

export const UX_PREVIEW_USER = {
  name: "نورة العتيبي — مستخدم معاينة",
  email: "ux-preview@innovation.local",
} as const;
