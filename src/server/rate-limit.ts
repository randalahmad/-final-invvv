import { createHmac } from "crypto";

import { prisma } from "@/server/db";

export type RateLimitAction = "LOGIN" | "REGISTRATION";

export interface RateLimitSubject {
  email: string;
  ipAddress?: string | null;
}

export interface RateLimitPolicy {
  maxAttempts: number;
  windowSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

const DEFAULTS: Record<RateLimitAction, RateLimitPolicy> = {
  LOGIN: { maxAttempts: 5, windowSeconds: 15 * 60 },
  REGISTRATION: { maxAttempts: 3, windowSeconds: 60 * 60 },
};

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function rateLimitPolicy(action: RateLimitAction): RateLimitPolicy {
  const defaults = DEFAULTS[action];
  return {
    maxAttempts: positiveInteger(process.env[`RATE_LIMIT_${action}_MAX_ATTEMPTS`], defaults.maxAttempts),
    windowSeconds: positiveInteger(process.env[`RATE_LIMIT_${action}_WINDOW_SECONDS`], defaults.windowSeconds),
  };
}

function hashingSecret(): string {
  const secret = process.env.RATE_LIMIT_HASH_SECRET ?? process.env.AUTH_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET or RATE_LIMIT_HASH_SECRET is required for rate limiting");
  }
  return "development-only-rate-limit-secret";
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizedIp(ipAddress: string | null | undefined): string {
  return ipAddress?.trim().toLowerCase() || "unknown";
}

function digest(value: string): string {
  return createHmac("sha256", hashingSecret()).update(value).digest("hex");
}

function bucketIdentity(
  action: RateLimitAction,
  subject: RateLimitSubject,
  policy: RateLimitPolicy,
  now: Date,
) {
  const windowMs = policy.windowSeconds * 1000;
  const windowStartMs = Math.floor(now.getTime() / windowMs) * windowMs;
  const windowStart = new Date(windowStartMs);
  const expiresAt = new Date(windowStartMs + windowMs);
  const subjectHash = digest(`${normalizeEmail(subject.email)}|${normalizedIp(subject.ipAddress)}`);
  const id = digest(`${action}|${subjectHash}|${windowStart.toISOString()}`);
  return { id, subjectHash, windowStart, expiresAt };
}

function result(count: number, policy: RateLimitPolicy, expiresAt: Date, now: Date): RateLimitResult {
  return {
    allowed: count <= policy.maxAttempts,
    remaining: Math.max(0, policy.maxAttempts - count),
    retryAfterSeconds: Math.max(1, Math.ceil((expiresAt.getTime() - now.getTime()) / 1000)),
  };
}

/** Read-only preflight used before password hashing. */
export async function checkRateLimit(
  action: RateLimitAction,
  subject: RateLimitSubject,
  now = new Date(),
): Promise<RateLimitResult> {
  const policy = rateLimitPolicy(action);
  const bucket = bucketIdentity(action, subject, policy, now);
  const existing = await prisma.rateLimitBucket.findUnique({
    where: { id: bucket.id },
    select: { count: true, expiresAt: true },
  });
  const count = existing?.count ?? 0;
  return {
    allowed: count < policy.maxAttempts,
    remaining: Math.max(0, policy.maxAttempts - count),
    retryAfterSeconds: Math.max(
      1,
      Math.ceil(((existing?.expiresAt ?? bucket.expiresAt).getTime() - now.getTime()) / 1000),
    ),
  };
}

/**
 * Atomically record an attempt in PostgreSQL. The upsert increment is shared
 * across application instances, so deployment topology cannot bypass limits.
 */
export async function consumeRateLimit(
  action: RateLimitAction,
  subject: RateLimitSubject,
  now = new Date(),
): Promise<RateLimitResult> {
  const policy = rateLimitPolicy(action);
  const bucket = bucketIdentity(action, subject, policy, now);
  const stored = await prisma.rateLimitBucket.upsert({
    where: { id: bucket.id },
    update: { count: { increment: 1 } },
    create: {
      id: bucket.id,
      action,
      subjectHash: bucket.subjectHash,
      windowStart: bucket.windowStart,
      expiresAt: bucket.expiresAt,
      count: 1,
    },
    select: { count: true, expiresAt: true },
  });
  return result(stored.count, policy, stored.expiresAt, now);
}

/** A successful login resets the current subject window. */
export async function clearRateLimit(
  action: RateLimitAction,
  subject: RateLimitSubject,
  now = new Date(),
): Promise<void> {
  const policy = rateLimitPolicy(action);
  const bucket = bucketIdentity(action, subject, policy, now);
  await prisma.rateLimitBucket.deleteMany({ where: { id: bucket.id } });
}
