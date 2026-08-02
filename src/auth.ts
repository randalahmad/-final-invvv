import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";

import authConfig from "@/auth.config";
import { prisma } from "@/server/db";
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
 * - JWT session strategy is required by the Credentials provider.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
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
