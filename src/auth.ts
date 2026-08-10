import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";

import authConfig from "@/auth.config";
import { prisma } from "@/server/db";
import { DEMO_MODE } from "@/server/demo-data";
import { loginSchema } from "@/modules/auth/schema";
import { authenticateCredentials } from "@/modules/auth/authenticate";
import { requestMetadataFromHeaders } from "@/server/request-context";

/**
 * Full (Node-runtime) Auth.js instance.
 *
 * - The Credentials provider delegates to `authenticateCredentials`, which is
 *   the single server-side gate: correct password AND registrationStatus=APPROVED
 *   AND status=ACTIVE. Any other case returns null → no session is issued.
 *   (User-facing reasons + blocked-login audit are handled in the login action,
 *   which also has request headers for IP/user-agent.)
 * - The Prisma adapter is wired so Microsoft Entra ID (OAuth) can be added later.
 *   Skipped entirely in DEMO_MODE (requirement: login must not depend on a
 *   database adapter) — the Credentials/JWT flow below never needs it anyway.
 * - JWT session strategy is required by the Credentials provider.
 * - DEMO_MODE gets a fixed local-only secret so `npm run dev` works with zero
 *   `.env` setup; a real deployment must still set AUTH_SECRET (unchanged).
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  ...(DEMO_MODE ? {} : { adapter: PrismaAdapter(prisma) }),
  secret: process.env.AUTH_SECRET ?? (DEMO_MODE ? "demo-mode-local-only-insecure-secret" : undefined),
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "البريد الإلكتروني", type: "email" },
        password: { label: "كلمة المرور", type: "password" },
      },
      authorize: async (credentials, request) => {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const result = await authenticateCredentials(
          parsed.data.email,
          parsed.data.password,
          requestMetadataFromHeaders(request.headers),
        );
        if (!result.ok) return null;

        const { id, name, email, registrationStatus, status, roleKeys } = result.user;
        return { id, name, email, registrationStatus, status, roleKeys };
      },
    }),
  ],
});
