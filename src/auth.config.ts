import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe Auth.js configuration shared between the middleware (edge runtime)
 * and the full Node config in `auth.ts`. It must NOT import Prisma, bcrypt, or
 * any Node-only module.
 *
 * Route protection is enforced here server-side via the `authorized` callback.
 * The JWT/session carry only lightweight identity claims (id, name, email,
 * registration + operational status, approved role keys) — never secrets,
 * password hashes, approval notes, or full permission lists.
 */
const PUBLIC_ROUTES = ["/login", "/register"];

export const authConfig = {
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isPublic = PUBLIC_ROUTES.some((r) => nextUrl.pathname.startsWith(r));

      if (isPublic) {
        // Logged-in users skip the login page; registration stays reachable.
        if (isLoggedIn && nextUrl.pathname.startsWith("/login")) {
          return Response.redirect(new URL("/dashboard", nextUrl));
        }
        return true;
      }
      return isLoggedIn;
    },
    jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        // Fields set by the Credentials `authorize` return value.
        const u = user as { registrationStatus?: string; status?: string; roleKeys?: string[] };
        token.registrationStatus = u.registrationStatus;
        token.status = u.status;
        token.roleKeys = u.roleKeys ?? [];
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        if (token.uid) session.user.id = token.uid as string;
        session.user.registrationStatus = token.registrationStatus as string | undefined;
        session.user.status = token.status as string | undefined;
        session.user.roleKeys = (token.roleKeys as string[] | undefined) ?? [];
      }
      return session;
    },
  },
} satisfies NextAuthConfig;

export default authConfig;
