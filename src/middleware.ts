import NextAuth from "next-auth";
import authConfig from "@/auth.config";

// Edge-safe middleware: protects every route except static assets and the
// Auth.js API handler. Uses only the edge-safe config (no Prisma / bcrypt).
export default NextAuth(authConfig).auth;

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico)$).*)"],
};
