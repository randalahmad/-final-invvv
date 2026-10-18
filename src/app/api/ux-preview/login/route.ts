import { NextResponse } from "next/server";

import { isUxPreviewMode, previewHomeForPersona } from "@/lib/ux-preview";
import { authenticateUxPreviewAccount, UX_PREVIEW_SESSION_COOKIE } from "@/server/ux-preview-accounts";

export async function POST(request: Request) {
  if (!isUxPreviewMode()) return NextResponse.json({ message: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => null) as { email?: unknown; password?: unknown } | null;
  const account = body && typeof body.email === "string" && typeof body.password === "string"
    ? authenticateUxPreviewAccount(body.email, body.password)
    : null;
  if (!account) return NextResponse.json({ message: "البريد الإلكتروني أو كلمة المرور غير صحيحة." }, { status: 401 });

  const response = NextResponse.json({ destination: previewHomeForPersona(account.persona) });
  response.cookies.set(UX_PREVIEW_SESSION_COOKIE, account.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  return response;
}
