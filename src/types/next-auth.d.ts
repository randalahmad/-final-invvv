import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      registrationStatus?: string;
      status?: string;
      roleKeys?: string[];
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
    registrationStatus?: string;
    status?: string;
    roleKeys?: string[];
  }
}
