import type { LinkedEntityType } from "@prisma/client";

import { prisma } from "@/server/db";
import type { AccessContext } from "@/server/access-context";
import { AuthorizationError } from "./errors";

export interface ShareLike {
  id: string;
  userId: string;
  entityType: LinkedEntityType;
  solutionId: string | null;
  agreementId: string | null;
  allowedActions: string[];
  allowedFields: string[];
  revokedAt: Date | null;
  expiresAt: Date | null;
}

/** A share is active when it is not revoked and not past its expiry. */
export function isShareActive(share: Pick<ShareLike, "revokedAt" | "expiresAt">, now: Date = new Date()): boolean {
  if (share.revokedAt) return false;
  if (share.expiresAt && share.expiresAt <= now) return false;
  return true;
}

/** All currently-active shares whose subject is this user. */
export async function getActiveSharesForUser(userId: string, now: Date = new Date()): Promise<ShareLike[]> {
  const shares = await prisma.resourceShare.findMany({ where: { userId, revokedAt: null } });
  return shares.filter((s) => isShareActive(s, now));
}

/** Solution ids the user can reach through an active share (feeds scope reads). */
export async function getActiveShareSolutionIds(userId: string, now: Date = new Date()): Promise<string[]> {
  const shares = await getActiveSharesForUser(userId, now);
  return shares
    .filter((s) => s.entityType === "INNOVATION_SOLUTION" && s.solutionId)
    .map((s) => s.solutionId as string);
}

/** Agreement ids reachable through an active share. */
export async function getActiveShareAgreementIds(userId: string, now: Date = new Date()): Promise<string[]> {
  const shares = await getActiveSharesForUser(userId, now);
  return shares
    .filter((s) => s.entityType === "COOPERATION_AGREEMENT" && s.agreementId)
    .map((s) => s.agreementId as string);
}

/** The active share (if any) covering a specific entity for a user. */
export async function findActiveShareForEntity(
  userId: string,
  entityType: LinkedEntityType,
  entityId: string,
  now: Date = new Date(),
): Promise<ShareLike | null> {
  const shares = await getActiveSharesForUser(userId, now);
  return (
    shares.find(
      (s) =>
        s.entityType === entityType &&
        ((entityType === "INNOVATION_SOLUTION" && s.solutionId === entityId) ||
          (entityType === "COOPERATION_AGREEMENT" && s.agreementId === entityId)),
    ) ?? null
  );
}

/**
 * Require that the caller holds an active share covering `entityId` that permits
 * `action`. Returns the share for a follow-up field check. Throws SHARE_INACTIVE
 * (no covering active share) or ACTION_NOT_ALLOWED (action not allow-listed).
 */
export async function requireShareAction(
  ctx: AccessContext,
  entityType: LinkedEntityType,
  entityId: string,
  action: string,
  now: Date = new Date(),
): Promise<ShareLike> {
  const share = await findActiveShareForEntity(ctx.userId, entityType, entityId, now);
  if (!share) throw new AuthorizationError("SHARE_INACTIVE");
  if (!share.allowedActions.includes(action)) throw new AuthorizationError("ACTION_NOT_ALLOWED");
  return share;
}
