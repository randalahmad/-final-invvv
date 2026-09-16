"use server";

import { AuthError } from "next-auth";
import { headers } from "next/headers";

import { signIn, signOut } from "@/auth";
import { loginSchema } from "./schema";
import { authenticateCredentials } from "./authenticate";
import { writeAudit, AUDIT } from "@/server/audit";
import { requestMetadataFromHeaders } from "@/server/request-context";
import { isDevelopmentRolePreviewEnabled, listDevelopmentRolePreviewOptions } from "./development-role-preview";

export interface LoginState {
  error?: string;
}

type BlockedReason = "PENDING" | "REJECTED" | "INACTIVE" | "SUSPENDED" | "RATE_LIMITED";

const BLOCKED_MESSAGE: Record<BlockedReason, string> = {
  PENDING: "حسابك قيد المراجعة من قِبل مدير النظام. سيتم إشعارك عند الاعتماد.",
  REJECTED: "تم رفض طلب التسجيل. للاستفسار يرجى التواصل مع مدير النظام.",
  INACTIVE: "الحساب غير مُفعّل حاليًا. يرجى التواصل مع مدير النظام.",
  SUSPENDED: "تم إيقاف الحساب مؤقتًا. يرجى التواصل مع مدير النظام.",
  RATE_LIMITED: "تم تجاوز عدد محاولات الدخول المسموح بها. حاول مرة أخرى لاحقًا.",
};

const BLOCKED_AUDIT = {
  PENDING: AUDIT.LOGIN_BLOCKED_PENDING,
  REJECTED: AUDIT.LOGIN_BLOCKED_REJECTED,
  INACTIVE: AUDIT.LOGIN_BLOCKED_INACTIVE,
  SUSPENDED: AUDIT.LOGIN_BLOCKED_SUSPENDED,
  RATE_LIMITED: AUDIT.LOGIN_RATE_LIMITED,
} as const;

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: "يرجى إدخال بريد إلكتروني وكلمة مرور صحيحين" };
  }

  // Determine the specific reason (and audit blocked states) BEFORE issuing a
  // session. This runs server-side and never reveals account state without a
  // correct password.
  const request = requestMetadataFromHeaders(headers());
  const result = await authenticateCredentials(parsed.data.email, parsed.data.password, request);
  if (!result.ok) {
    // authenticateCredentials already records the rate-limit audit so direct
    // Auth.js callback attempts and server-action attempts share one control.
    if (result.reason === "RATE_LIMITED") {
      return { error: BLOCKED_MESSAGE.RATE_LIMITED };
    }
    if (result.reason !== "INVALID_CREDENTIALS") {
      await writeAudit({
        actorUserId: result.userId ?? null,
        action: BLOCKED_AUDIT[result.reason],
        entityId: result.userId ?? null,
        summary: "محاولة دخول محجوبة",
        ipAddress: request.ipAddress,
        userAgent: request.userAgent,
      });
      return { error: BLOCKED_MESSAGE[result.reason] };
    }
    return { error: "بريد إلكتروني أو كلمة مرور غير صحيحة" };
  }

  try {
    await signIn("credentials", { ...parsed.data, redirectTo: "/dashboard" });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "بريد إلكتروني أو كلمة مرور غير صحيحة" };
    }
    throw error; // re-throw NEXT_REDIRECT and other control-flow errors
  }
  return {};
}

export async function logoutAction(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}

function safeRolePreviewRedirect(value: FormDataEntryValue | null): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  return value;
}

/** Local development-only session switch. Auth.js still issues a normal session. */
export async function switchDevelopmentRoleAction(formData: FormData): Promise<void> {
  if (!isDevelopmentRolePreviewEnabled()) return;
  const email = typeof formData.get("email") === "string" ? String(formData.get("email")) : "";
  const options = await listDevelopmentRolePreviewOptions();
  if (!options.some((option) => option.email === email)) return;

  await signIn("credentials", {
    devPreviewEmail: email,
    redirectTo: safeRolePreviewRedirect(formData.get("callbackUrl")),
  });
}

/**
 * Local development-only entry point. This deliberately still creates a real
 * Auth.js session for an allow-listed seeded identity; it only removes the
 * need to type demo credentials on the local login screen.
 */
export async function enterDevelopmentPreviewAction(): Promise<void> {
  if (!isDevelopmentRolePreviewEnabled()) return;
  const options = await listDevelopmentRolePreviewOptions();
  const defaultIdentity = options.find((option) => option.email === "innovator@innovation.local") ?? options[0];
  if (!defaultIdentity) return;

  await signIn("credentials", {
    devPreviewEmail: defaultIdentity.email,
    redirectTo: defaultIdentity.email === "innovator@innovation.local" ? "/journey" : "/dashboard",
  });
}
