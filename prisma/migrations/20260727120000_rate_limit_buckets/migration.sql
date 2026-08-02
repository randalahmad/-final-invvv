-- Durable, multi-instance fixed-window rate-limit counters.
CREATE TABLE "rate_limit_buckets" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "subjectHash" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_limit_buckets_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "rate_limit_buckets_action_subjectHash_idx"
ON "rate_limit_buckets"("action", "subjectHash");

CREATE INDEX "rate_limit_buckets_expiresAt_idx"
ON "rate_limit_buckets"("expiresAt");
