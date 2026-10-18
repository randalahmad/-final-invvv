import { NextResponse } from "next/server";

import { isUxPreviewMode } from "@/lib/ux-preview";
import { UX_PREVIEW_SESSION_COOKIE } from "@/server/ux-preview-accounts";

export async function POST() {
  if (!isUxPreviewMode()) return NextResponse.json({ message: "Not found" }, { status: 404 });
  const response = NextResponse.json({ destination: "/login" });
  response.cookies.set(UX_PREVIEW_SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  return response;
}
