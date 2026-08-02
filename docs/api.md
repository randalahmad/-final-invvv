# API — Server Actions & HTTP Routes

This platform has **no separate REST/GraphQL API layer**. Almost every mutation is a Next.js **Server Action** — a function called directly from a form/component, running on the server, with no separate HTTP contract to version or document per-endpoint. There are exactly **two** real HTTP routes, both listed in full below.

## Server Actions (the de facto API)

**Location convention:** every `src/modules/<name>/actions.ts` file. Each exported `"use server"` function is called directly from that module's `components/*.tsx` via `useFormState`/`<form action={...}>` — never fetched over HTTP by a client.

**Shape convention (identical across every module):**
```ts
export async function xAction(_prev: XFormState, formData: FormData): Promise<XFormState> {
  const ctx = await getAccessContext();
  if (!ctx) return { error: "غير مصرّح" };
  try {
    await someServiceFunction(ctx, ...readFrom(formData));
  } catch (e) {
    return toFormState(e); // maps StrategyError/CommitteeError/ChallengeError/etc. → Arabic message
  }
  revalidatePath(...);
  redirect(...) // or return a success state
}
```

**Authorization:** the action itself never checks permissions — it forwards to a `service.ts` function, which calls `requirePermission(actor, ...)` before doing anything. This is deliberate defense-in-depth: even if an action were called directly (bypassing the UI), the service layer still rejects unauthorized calls. See `architecture.md` and `test-plan.md` item P-10.

**Full action inventory by module** (each list is exhaustive as of Code Freeze):

| Module | Actions |
|---|---|
| `ideas` | `createIdeaAction`, `updateIdeaAction`, `submitIdeaAction`, `withdrawIdeaAction`, `archiveIdeaAction`, `restoreIdeaAction`, plus evaluation/decision actions in `ideas/*` |
| `solutions` | `createSolutionAction`, `updateSolutionAction`, `updateSharedFieldsAction`, `archiveSolutionAction`, plus lifecycle/publish/share/org actions |
| `evidence` | `uploadEvidenceAction`, `uploadActivityEvidenceAction`, `replaceEvidenceFileAction`, `submitEvidenceAction`, `startReviewAction`, `approveEvidenceAction`, `rejectEvidenceAction`, `archiveEvidenceAction`, `linkEvidenceAction`, `unlinkEvidenceAction` |
| `strategy` | `createObjectiveAction`, `updateObjectiveAction`, `archiveObjectiveAction`, `createAssignmentAction`, `updateAssignmentAction`, `archiveAssignmentAction`, `uploadStrategyDocumentAction`, `updateStrategyDocumentAction`, `archiveStrategyDocumentAction` |
| `activities` | `createActivityAction`, `updateActivityAction`, `archiveActivityAction` |
| `committees` | `createCommitteeAction`, `updateCommitteeAction`, `archiveCommitteeAction`, `addCommitteeMemberAction`, `updateCommitteeMemberAction`, `endCommitteeMembershipAction`, `createCommitteeMeetingAction`, `updateCommitteeMeetingAction`, `archiveCommitteeMeetingAction` |
| `challenges` | `createChallengeAction`, `updateChallengeAction`, `updateChallengeStatusAction`, `archiveChallengeAction`, `linkChallengeSolutionAction`, `unlinkChallengeSolutionAction` |
| `admin/users` | `approveAction`, `rejectAction`, `accountStateAction`, `assignRoleAction`, `removeRoleAction` |
| `document-analysis`, `registration`, `auth`, `compliance` | pre-existing, unchanged this integration |

`audit`, `alerts`, `reports` are **read-only modules** — they expose `service.ts` functions consumed directly by their `page.tsx` (Server Components), with no `actions.ts` at all (nothing to mutate).

## Real HTTP routes

### `GET/POST /api/auth/[...nextauth]`
`src/app/api/auth/[...nextauth]/route.ts` — thin re-export of NextAuth's own handlers (`export const { GET, POST } = handlers`). Not modified by this integration. Standard NextAuth session/callback endpoint contract applies.

### `GET /api/evidence/[id]/download`
`src/app/api/evidence/[id]/download/route.ts` — the one genuine file-download endpoint in the platform, because a file download needs a real HTTP response (headers, streaming/redirect), which a Server Action cannot produce.

- **Input:** evidence id in the URL path only — the client never supplies a storage key or path directly.
- **Auth:** `getAccessContext()` first; `401` if no session. Then `prepareEvidenceDownload(ctx, id)` re-checks authorization for that specific evidence record before minting anything.
- **On denial:** `auditDownloadDenied(...)` writes `EVIDENCE_DOWNLOAD_DENIED` (see `audit-events.md`) — a rejected download attempt is itself an audited security event, not silently dropped.
- **Response:** either a short-lived signed URL (when the storage provider supports it and it's enabled) or the file bytes streamed through the server; always `private, no-store` so no shared proxy caches it.
- This route serves **every** entity type's evidence (solution, activity, strategy-document) identically — it doesn't need to know which; `prepareEvidenceDownload` resolves that from the `Evidence` row itself.

## What this means for integration/automation
There is no OpenAPI/Swagger surface to generate against, because there is (deliberately) almost nothing to call except these two routes. Any external system integration would need to either (a) use the NextAuth session + call the download route for files, or (b) a genuinely new API layer would need to be designed — out of scope for the current Code Freeze.
