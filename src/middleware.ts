import { NextResponse, type NextRequest } from "next/server";
import { canPreviewPersonaAccessPath, isUxPreviewMode, previewPersonaFromSearch } from "@/lib/ux-preview";

// Edge-safe middleware: protects every route except static assets and the
// Auth.js API handler. Uses only the edge-safe config (no Prisma / bcrypt).
export default async function middleware(request: NextRequest) {
  if (isUxPreviewMode()) {
    if (request.nextUrl.pathname.startsWith("/api/auth")) {
      return NextResponse.json({ message: "Authentication is disabled in UX Preview Mode" }, { status: 404 });
    }
    const url = request.nextUrl.clone();
    if (url.pathname === "/" || url.pathname.startsWith("/login") || url.pathname.startsWith("/register")) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    const previewRole = previewPersonaFromSearch(request.nextUrl.searchParams.get("previewRole"));
    if (!canPreviewPersonaAccessPath(previewRole, request.nextUrl.pathname)) {
      const dashboard = new URL("/dashboard", request.url);
      dashboard.searchParams.set("previewRole", previewRole);
      return NextResponse.redirect(dashboard);
    }
    url.pathname = "/ux-preview";
    url.search = "";
    url.searchParams.set("path", request.nextUrl.pathname);
    url.searchParams.set("role", previewRole);
    return NextResponse.rewrite(url);
  }
  if (request.nextUrl.pathname.startsWith("/api/auth")) return NextResponse.next();
  const [{ default: NextAuth }, { default: authConfig }] = await Promise.all([
    import("next-auth"),
    import("@/auth.config"),
  ]);
  return NextAuth(authConfig).auth(request as never);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico)$).*)"],
};
