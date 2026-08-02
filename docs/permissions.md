# Permissions — Current Catalogue

Single source of truth in code: `src/modules/auth/permissions.ts`. This document mirrors it exactly as of the current Code Freeze — regenerate this file by hand if that source ever changes. For the narrative role descriptions (what each role *is*), see `roles-and-permissions.md`; this file is the flat, current key-by-key reference including everything added after that document was first written.

**Golden rule (unchanged):** the platform authorizes on **permission + data scope**, never on a bare role label. Holding a `*_VIEW` permission means "see records inside your granted scope," not "see everything."

Legend: **✔** = default role grant (seeded automatically) · **➕** = grantable per individual user, not a role default · **—** = never grantable to that role.

## Full matrix

| Permission key | SYSTEM_ADMIN | INTERNAL_EDITOR | EXTERNAL_PARTNER | VIEWER |
|---|:---:|:---:|:---:|:---:|
| `solution.view` | ✔ | ✔ | ✔ | ✔ |
| `solution.create` | ✔ | ✔ | — | — |
| `solution.update` | ✔ | ✔ | — | — |
| `solution.archive` | ✔ | ➕ | — | — |
| `strategy.objective.view` | ✔ | ✔ | — | — |
| `strategy.objective.manage` | ✔ | ➕ | — | — |
| `strategy.assignment.manage` | ✔ | — | — | — |
| `strategy.document.view` | ✔ | ✔ | — | — |
| `strategy.document.upload` | ✔ | ✔ | — | — |
| `strategy.document.manage` | ✔ | ✔ | — | — |
| `strategy.document.archive` | ✔ | ➕ | — | — |
| `activity.view` | ✔ | ✔ | — | — |
| `activity.manage` | ✔ | ✔ | — | — |
| `committee.view` | ✔ | ✔ | — | — |
| `committee.manage` | ✔ | — | — | — |
| `committee.meeting.manage` | ✔ | ➕ | — | — |
| `challenge.view` | ✔ | ✔ | — | — |
| `challenge.create` | ✔ | ✔ | — | — |
| `challenge.update` | ✔ | ✔ | — | — |
| `challenge.archive` | ✔ | ➕ | — | — |
| `idea.view` | ✔ | ✔ | — | ➕ |
| `idea.evaluate` | ✔ | ✔ | — | — |
| `idea.decide` | ✔ | — | — | — |
| `impact.view` | ✔ | ✔ | — | ✔ |
| `impact.update` | ✔ | ✔ | — | — |
| `impact.verify` | ✔ | — | — | — |
| `agreement.view` | ✔ | ✔ | ✔ | ✔ |
| `agreement.update` | ✔ | — | ✔ | — |
| `meeting.update` | ✔ | — | ✔ | — |
| `evidence.view` | ✔ | ✔ | ✔ | ✔ |
| `evidence.upload` | ✔ | ✔ | ✔ | — |
| `evidence.approve` | ✔ | — | — | — |
| `compliance.view` | ✔ | ✔ | — | ✔ |
| `compliance.configure` | ✔ | — | — | — |
| `compliance.export` | ✔ | — | — | — |
| `alert.view` | ✔ | ✔ | — | ✔ |
| `alert.resolve` | ✔ | ✔ | — | — |
| `user.manage` | ✔ | — | — | — |
| `role.manage` | ✔ | — | — | — |
| `audit.view` | ✔ | — | — | — |

## Notes on deliberate gaps (not bugs)

- **`strategy.objective.manage`, `strategy.assignment.manage`, `committee.manage`, `committee.meeting.manage`, `challenge.archive`, `strategy.document.archive`, `solution.archive`** follow a consistent pattern across the platform: governance/assignment-type actions default to SYSTEM_ADMIN only, with select ones grantable per-user (➕) rather than opened to the whole `INTERNAL_EDITOR` role. This was an explicit design decision, not an oversight — see the approved permission matrix discussion in the project history.
- **`impact.view/update`, `agreement.*`, `meeting.update`** are used by the pre-existing `impact`/`partners` modules, which remain placeholder pages (see `modules.md`). The permissions exist and are seeded but currently gate nothing reachable in the UI.
- **`alert.resolve`** is granted but no "resolve alert" UI action exists yet — `/alerts` is currently read-only display (see `modules.md`).

## What requires re-running `prisma db seed`

Any change to `PERMISSIONS`, `DEFAULT_ROLE_PERMISSIONS`, or `DEFAULT_ROLES` in `src/modules/auth/permissions.ts` only takes effect in a live database after `npx prisma db seed` is re-run — the seed script upserts `Permission`/`Role`/`RolePermission` rows from this file; nothing in the running app reads `permissions.ts` directly for the actual grant, only for the permission-key constants used in `requirePermission(...)` calls.
