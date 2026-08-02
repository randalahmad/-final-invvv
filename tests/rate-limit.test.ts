import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/server/db";
import { authenticateCredentials } from "@/modules/auth/authenticate";
import { submitRegistration } from "@/modules/registration/service";
import { checkRateLimit, consumeRateLimit } from "@/server/rate-limit";

const previous = {
  loginMax: process.env.RATE_LIMIT_LOGIN_MAX_ATTEMPTS,
  loginWindow: process.env.RATE_LIMIT_LOGIN_WINDOW_SECONDS,
  registrationMax: process.env.RATE_LIMIT_REGISTRATION_MAX_ATTEMPTS,
  registrationWindow: process.env.RATE_LIMIT_REGISTRATION_WINDOW_SECONDS,
};

process.env.RATE_LIMIT_LOGIN_MAX_ATTEMPTS = "2";
process.env.RATE_LIMIT_LOGIN_WINDOW_SECONDS = "3600";
process.env.RATE_LIMIT_REGISTRATION_MAX_ATTEMPTS = "2";
process.env.RATE_LIMIT_REGISTRATION_WINDOW_SECONDS = "3600";

beforeEach(async () => {
  await prisma.rateLimitBucket.deleteMany();
});

afterAll(() => {
  const restore = (key: string, value: string | undefined) => {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  };
  restore("RATE_LIMIT_LOGIN_MAX_ATTEMPTS", previous.loginMax);
  restore("RATE_LIMIT_LOGIN_WINDOW_SECONDS", previous.loginWindow);
  restore("RATE_LIMIT_REGISTRATION_MAX_ATTEMPTS", previous.registrationMax);
  restore("RATE_LIMIT_REGISTRATION_WINDOW_SECONDS", previous.registrationWindow);
});

describe("durable PostgreSQL rate limiting", () => {
  it("atomically shares a fixed-window counter across concurrent callers", async () => {
    const subject = { email: "Concurrent@Example.test", ipAddress: "203.0.113.10" };
    const results = await Promise.all(Array.from({ length: 4 }, () => consumeRateLimit("LOGIN", subject)));
    expect(results.filter((result) => result.allowed)).toHaveLength(2);
    expect(await prisma.rateLimitBucket.count()).toBe(1);
    expect((await prisma.rateLimitBucket.findFirstOrThrow()).count).toBe(4);
  });

  it("normalizes email and separates IP subjects", async () => {
    await consumeRateLimit("LOGIN", { email: " User@Example.test ", ipAddress: "203.0.113.11" });
    await consumeRateLimit("LOGIN", { email: "user@example.test", ipAddress: "203.0.113.11" });
    expect((await checkRateLimit("LOGIN", { email: "USER@example.test", ipAddress: "203.0.113.11" })).remaining).toBe(0);
    expect((await checkRateLimit("LOGIN", { email: "user@example.test", ipAddress: "203.0.113.12" })).remaining).toBe(2);
  });

  it("limits repeated login failures and audits the lockout", async () => {
    const request = { ipAddress: "203.0.113.20", userAgent: "vitest" };
    const email = "admin@innovation.local";
    expect(await authenticateCredentials(email, "wrong-password", request)).toMatchObject({ ok: false, reason: "INVALID_CREDENTIALS" });
    expect(await authenticateCredentials(email, "wrong-password", request)).toMatchObject({ ok: false, reason: "INVALID_CREDENTIALS" });
    expect(await authenticateCredentials(email, "wrong-password", request)).toMatchObject({ ok: false, reason: "RATE_LIMITED" });
    expect(
      await prisma.auditLog.findFirst({ where: { action: "LOGIN_RATE_LIMITED", ipAddress: request.ipAddress } }),
    ).not.toBeNull();
  });

  it("clears prior failures after a successful login", async () => {
    const request = { ipAddress: "203.0.113.21", userAgent: "vitest" };
    const email = "admin@innovation.local";
    expect(await authenticateCredentials(email, "wrong-password", request)).toMatchObject({ ok: false, reason: "INVALID_CREDENTIALS" });
    expect((await checkRateLimit("LOGIN", { email, ipAddress: request.ipAddress })).remaining).toBe(1);
    expect((await authenticateCredentials(email, "Admin@12345", request)).ok).toBe(true);
    expect((await checkRateLimit("LOGIN", { email, ipAddress: request.ipAddress })).remaining).toBe(2);
  });

  it("limits repeated registration attempts and audits the lockout", async () => {
    const email = `limited_${Date.now()}@example.test`;
    const request = { ipAddress: "203.0.113.30", userAgent: "vitest" };
    const input = {
      name: "مستخدم اختبار",
      email,
      password: "Password123",
      confirmPassword: "Password123",
      requestedRole: "VIEWER",
      acceptTerms: true,
    };
    expect((await submitRegistration(input, request)).ok).toBe(true);
    expect(await submitRegistration(input, request)).toMatchObject({ ok: false, error: "DUPLICATE_EMAIL" });
    expect(await submitRegistration(input, request)).toMatchObject({ ok: false, error: "RATE_LIMITED" });
    expect(
      await prisma.auditLog.findFirst({ where: { action: "REGISTRATION_RATE_LIMITED", ipAddress: request.ipAddress } }),
    ).not.toBeNull();
  });
});
