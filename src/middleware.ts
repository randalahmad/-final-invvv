import { NextResponse, type NextRequest } from "next/server";
import { canPreviewPersonaAccessPath, isUxPreviewMode, previewHomeForPersona } from "@/lib/ux-preview";
import { DEMO_MODE } from "@/server/demo-data";
import { UX_PREVIEW_SESSION_COOKIE, uxPreviewAccountFromToken } from "@/server/ux-preview-accounts";

// Edge-safe middleware: protects every route except static assets and the
// Auth.js API handler. Uses only the edge-safe config (no Prisma / bcrypt).
export default async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/solution-intake/")) return NextResponse.next();
  if (request.nextUrl.pathname.startsWith("/contribute/")) return NextResponse.next();
  if (request.nextUrl.pathname.startsWith("/submit/") && isUxPreviewMode()) return NextResponse.next();
  if (request.nextUrl.pathname === "/api/ux-preview/idea-readiness" && isUxPreviewMode()) return NextResponse.next();
  if (isUxPreviewMode()) {
    if (request.nextUrl.pathname === "/api/ux-preview/login" || request.nextUrl.pathname === "/api/ux-preview/logout") return NextResponse.next();
    // Internal rewrite target: render it once instead of feeding it back into
    // the public preview routing layer.
    if (request.nextUrl.pathname === "/ux-preview") return NextResponse.next();
    if (request.nextUrl.pathname.startsWith("/api/auth")) {
      return NextResponse.json({ message: "Authentication is disabled in UX Preview Mode" }, { status: 404 });
    }
    const account = uxPreviewAccountFromToken(request.cookies.get(UX_PREVIEW_SESSION_COOKIE)?.value);
    if (request.nextUrl.pathname === "/login") {
      if (!account) return NextResponse.next();
      const home = new URL(previewHomeForPersona(account.persona), request.url);
      home.searchParams.set("previewRole", account.persona);
      return NextResponse.redirect(home);
    }
    if (request.nextUrl.pathname === "/register") return NextResponse.redirect(new URL("/login", request.url));
    if (!account) {
      const login = new URL("/login", request.url);
      login.searchParams.set("callbackUrl", `${request.nextUrl.pathname}${request.nextUrl.search}`);
      return NextResponse.redirect(login);
    }

    const url = request.nextUrl.clone();
    const previewAccount = request.nextUrl.searchParams.get("previewAccount");
    const previewRole = account.persona;
    if (url.pathname === "/") {
      const home = new URL(previewHomeForPersona(previewRole), request.url);
      home.searchParams.set("previewRole", previewRole);
      if (previewRole === "innovator" && previewAccount) home.searchParams.set("previewAccount", previewAccount);
      return NextResponse.redirect(home);
    }
    if (request.nextUrl.searchParams.get("previewRole") !== previewRole) {
      url.searchParams.set("previewRole", previewRole);
      if (previewRole !== "innovator") url.searchParams.delete("previewAccount");
      return NextResponse.redirect(url);
    }
    if (!canPreviewPersonaAccessPath(previewRole, request.nextUrl.pathname)) {
      const home = new URL(previewHomeForPersona(previewRole), request.url);
      home.searchParams.set("previewRole", previewRole);
      if (previewRole === "innovator" && previewAccount) home.searchParams.set("previewAccount", previewAccount);
      return NextResponse.redirect(home);
    }
    url.pathname = "/ux-preview";
    url.search = "";
    url.searchParams.set("path", request.nextUrl.pathname);
    url.searchParams.set("role", previewRole);
    url.searchParams.set("previewRole", previewRole);
    if (previewRole === "innovator" && previewAccount) url.searchParams.set("previewAccount", previewAccount);
    return NextResponse.rewrite(url);
  }
  if (request.nextUrl.pathname.startsWith("/api/auth")) return NextResponse.next();
  const [{ default: NextAuth }, { default: authConfig }] = await Promise.all([
    import("next-auth"),
    import("@/auth.config"),
  ]);
  return NextAuth({
    ...authConfig,
    secret: process.env.AUTH_SECRET ?? (DEMO_MODE ? "demo-mode-local-only-insecure-secret" : undefined),
  }).auth(request as never);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico)$).*)"],
};
