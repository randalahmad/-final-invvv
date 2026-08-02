# Technical Decisions (ADR summary) — منصة إدارة الابتكار المؤسسي

Confirmed stack and the rationale, alternatives, risks, and migration implications for each choice. The overarching decision is a **Modular Monolith** (Next.js App Router) — no microservices — maintainable by a small team and self-hostable.

---

## 0. Architecture: Modular Monolith
- **Decision:** one deployable Next.js application, organized by domain modules (`src/modules/*`) with a shared server layer (`src/server/*`).
- **Why:** small team, tightly-related domain, need for transactional consistency across ideas→solutions→evidence→compliance; a monolith gives simplicity, one auth boundary, and easy self-hosting.
- **Alternatives:** microservices (rejected — operational overhead, distributed transactions, no demonstrated need); separate SPA + API (rejected — duplicates auth, loses server components).
- **Risks:** module boundaries can erode → enforce via folder structure + shared server guards + lint boundaries.
- **Migration implication:** if a piece ever needs to scale independently (e.g. document analysis), it can be extracted behind the existing job interface without reworking the domain.

---

## 1. Next.js (App Router)
- **Why:** first-class React Server Components (authorization/data on the server by default), file-based routing, server actions, mature RTL/SSR, strong self-hosting story (`next start`/Node/Docker).
- **Alternatives:** Remix (smaller ecosystem for this team), plain React SPA + Express (loses RSC + server-by-default security), Nuxt/SvelteKit (team is React).
- **Risks:** App Router learning curve; RSC/CSR boundary mistakes leaking data → mitigated by "server by default, client only on interaction" rule.
- **Migration:** already the chosen base; Vite prototype is reference-only and is being retired after porting.

## 2. TypeScript (strict)
- **Why:** type safety across a large domain model; shared types between DB (Prisma) and UI; strict mode catches nulls/scope bugs early.
- **Alternatives:** JavaScript (rejected — unsafe at this domain size).
- **Risks:** stricter iteration cost → offset by Prisma-generated types + Zod inference.
- **Migration:** `tsconfig` strict already set; no JS/TS duplication permitted.

## 3. PostgreSQL
- **Why:** relational integrity for a highly-relational governance domain; JSON columns for configurable requirement definitions; mature, self-hostable, strong constraints/indexing.
- **Alternatives:** MySQL (weaker JSON/ergonomics), MongoDB (rejected — the domain is relational; referential integrity matters for compliance), SQLite (fine for dev, not for concurrent enterprise use).
- **Risks:** connection management on serverless hosts → use pooling (PgBouncer/Neon) if deployed serverless; self-hosted Node server avoids this.
- **Migration:** Prisma migrations; PostgreSQL is the single supported engine.

## 4. Prisma ORM
- **Why:** typed client, first-class migrations, readable schema, good Postgres support, Auth.js adapter available.
- **Alternatives:** Drizzle (leaner but less mature migration/adapter tooling for this team), raw SQL/Kysely (more control, more boilerplate).
- **Risks:** no native polymorphic FKs → handled with the `(entityType, entityId)` + enum whitelist strategy (see `authorization.md`/`data-dictionary.md`); application-level integrity checks required.
- **Migration:** schema already models the domain; deltas (AI analysis, registration status) are additive.

## 5. Auth.js (NextAuth v5)
- **Why:** standard for Next.js; Credentials provider for pilot; Prisma adapter + Account/Session models already present; **Entra ID provider can be added without redesign**.
- **Alternatives:** custom JWT/session (reinventing security-critical code), Clerk/Auth0 (external dependency/cost, data-residency questions for a government entity).
- **Risks:** must not conflate authentication with authorization — Auth.js handles *who you are*; the app's scope guard handles *what you may touch*.
- **Migration:** credentials → Entra ID is a provider addition; sessions/accounts schema already supports OAuth.

## 6. Tailwind CSS
- **Why:** fast, consistent styling; excellent RTL support with logical utilities; design tokens already configured.
- **Alternatives:** CSS Modules/vanilla (slower iteration), MUI/Chakra (heavier, less RTL-clean, opinionated).
- **Risks:** utility sprawl → contained via shared components in `components/ui` + `components/shared`.
- **Migration:** config ported from prototype; tokens defined.

## 7. shadcn/ui
- **Why:** unstyled-but-accessible primitives you **own in-repo** (no vendor lock/runtime dep), Tailwind-native, easy RTL adaptation, accessible labels/semantics by default.
- **Alternatives:** MUI/AntD (heavy, harder RTL, external theming), Radix-only (more wiring), building from scratch (time).
- **Risks:** components are copied in → must keep them consistent; treat `components/ui` as owned code.
- **Migration:** primitives reused from the existing Next.js foundation.

## 8. TanStack Table
- **Why:** headless, powerful tables (registry, users, evidence lists) with sorting/filtering/pagination while keeping full RTL/markup control.
- **Alternatives:** AG Grid (heavy/licensing), hand-rolled tables (re-implementing paging/sorting).
- **Risks:** headless verbosity → wrap in a shared `DataTable`.
- **Migration:** additive; used "where useful," not everywhere.

## 9. Recharts
- **Why:** React-native charts for dashboards (readiness, counts, trends); simple, declarative, adequate for MVP visuals.
- **Alternatives:** Chart.js (imperative), ECharts/visx (heavier/lower-level), Nivo (heavier).
- **Risks:** RTL/label localization for Arabic → handled with formatters + wrapper.
- **Migration:** additive; chart wrappers reusable from foundation.

## 10. dnd-kit
- **Why:** accessible drag-and-drop for the governance Kanban; keyboard support; RTL-capable; the board persists transitions server-side (drag = server action).
- **Alternatives:** react-beautiful-dnd (maintenance concerns, weaker RTL), native HTML5 DnD (accessibility gaps).
- **Risks:** must not treat the board as source of truth → status persists in DB; UI is a projection.
- **Migration:** used only for the Kanban.

## 11. Supporting choices (confirmed)
- **Zod** — runtime validation for all inputs, requirement-definition JSON, and API boundaries; infers TS types.
- **React Hook Form** — accessible, performant forms with Zod resolvers.
- **Validation happens server-side too** — RHF/Zod on the client is UX; the server re-validates every mutation.

---

## 12. Cross-cutting technical risks

| # | Risk | Mitigation |
|---|---|---|
| T1 | RSC/CSR boundary leaks sensitive data to client bundles | "Server by default"; sensitive data never passed to client components; lint rule/review |
| T2 | Polymorphic evidence links lack DB FK integrity | App-level existence + scope validation; unique `(evidenceId, entityType, entityId)`; enum whitelist |
| T3 | Async document analysis reliability | Queue + retries + `FAILED` fallback to manual mapping; status polling |
| T4 | Readiness computed on read may get expensive at scale | Acceptable for MVP volumes; materialize/cache later behind same interface |
| T5 | Arabic RTL regressions in third-party libs | RTL checklist, wrapper components, verified in shell |
| T6 | Self-hosting parity vs. serverless | Prefer Node server (`next start`) for pilot to sidestep serverless DB pooling; document both paths |
| T7 | Data residency for any external AI model | Keep extraction self-hostable where feasible; external model use needs KACARE sign-off |

---

## 13. What is explicitly NOT chosen
- No microservices, no message-broker infra, no separate API gateway.
- No external BaaS for auth/data (government data-residency posture).
- No AI beyond the bounded document-analysis assistant.
- No ORM/database other than Prisma/PostgreSQL.
