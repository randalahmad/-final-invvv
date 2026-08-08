import NextAuth from "next-auth";
import { NextResponse, type NextRequest } from "next/server";
import authConfig from "@/auth.config";
import { isUxPreviewMode } from "@/lib/ux-preview";

// Edge-safe middleware: protects every route except static assets and the
// Auth.js API handler. Uses only the edge-safe config (no Prisma / bcrypt).
const authMiddleware = NextAuth(authConfig).auth;

export default function middleware(request: NextRequest) {
  if (isUxPreviewMode()) {
    const url = request.nextUrl.clone();
    if (url.pathname === "/" || url.pathname.startsWith("/login") || url.pathname.startsWith("/register")) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    const previewRole = request.nextUrl.searchParams.get("previewRole");
    url.pathname = "/ux-preview";
    url.search = "";
    url.searchParams.set("path", request.nextUrl.pathname);
    if (previewRole) url.searchParams.set("role", previewRole);
    return NextResponse.rewrite(url);
  }
  return authMiddleware(request as never);
}

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico)$).*)"],
};
