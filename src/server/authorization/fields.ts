import type { LinkedEntityType } from "@prisma/client";

import type { AccessContext } from "@/server/access-context";
import { AuthorizationError } from "./errors";
import { requireShareAction, type ShareLike } from "./share";

/**
 * Fields an External Partner may NEVER write, regardless of a share's
 * allowedFields (ownership, status, verification, readiness, approval,
 * publication, immutability metadata). See authorization.md §5.2.
 */
export const PARTNER_FORBIDDEN_FIELDS: ReadonlySet<string> = new Set([
  // ownership
  "ownerUserId",
  "owningDepartmentId",
  "responsibleUserId",
  "partnerOrgId",
  "organizationId",
  "userId",
  // status / lifecycle
  "status",
  "registrationStatus",
  "implementationStatus",
  "maturityStage",
  "renewalStatus",
  // processing / review / verification
  "fileProcessingStatus",
  "reviewStatus",
  "verificationStatus",
  // readiness / publication
  "completionPct",
  "evidenceReadinessPct",
  "publishedAt",
  // approval / immutability metadata
  "approvedById",
  "approvedAt",
  "finalizedAt",
  "finalizedById",
  "verifiedAt",
  "verifiedById",
  "archivedAt",
  "archivedById",
]);

/**
 * Validate that every field a partner is trying to write is (a) not globally
 * forbidden and (b) inside this share's allowedFields. Throws FIELD_FORBIDDEN
 * on the first violation.
 */
export function assertFieldsWithinShare(share: Pick<ShareLike, "allowedFields">, fields: string[]): void {
  for (const field of fields) {
    if (PARTNER_FORBIDDEN_FIELDS.has(field)) throw new AuthorizationError("FIELD_FORBIDDEN", `forbidden field: ${field}`);
    if (!share.allowedFields.includes(field)) throw new AuthorizationError("FIELD_FORBIDDEN", `field not shared: ${field}`);
  }
}

/**
 * Full partner field-write guard: require an active share permitting `action`
 * over the entity, then validate the touched fields against the allow-list.
 */
export async function requirePartnerFieldWrite(
  ctx: AccessContext,
  entityType: LinkedEntityType,
  entityId: string,
  fields: string[],
  action = "update_fields",
): Promise<ShareLike> {
  const share = await requireShareAction(ctx, entityType, entityId, action);
  assertFieldsWithinShare(share, fields);
  return share;
}
