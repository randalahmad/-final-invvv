# Domain modules

The application is a **modular monolith**: business logic is organised by domain
module, not by generic technical folders. Each module owns its types, mock/seed
data (until DB-backed), server logic, and UI components.

| Module | Compliance area | Responsibility |
| --- | --- | --- |
| `auth` | — | Authentication (Auth.js), permission catalog, login/logout actions |
| `users` | — | User administration |
| `organizations` | supporting | Organizations, departments, memberships |
| `strategy` | 5.23.1 | Strategic direction, objectives, KPIs |
| `activities` | 5.23.2 | Innovation activities & events |
| `governance` | 5.23.3 | Ideas, evaluations, decisions, Kanban |
| `solutions` | 5.24.1 | Innovation solutions registry |
| `impact` | 5.24.2 | Impact indicators & measurements |
| `partners` | supporting | Partner orgs, agreements, meetings |
| `evidence` | supporting | Evidence + polymorphic links to records/requirements |
| `compliance` | DGA | Configurable requirements, readiness, export |
| `alerts` | supporting | Time-based alerts center |
| `reports` | supporting | Dashboards & reports |
| `audit` | supporting | Audit log of significant actions |

Modules implemented in this foundation phase (with UI): `auth`, `dashboard`
(app/dashboard), `solutions`, `governance`, `alerts`. The rest are scaffolded as
domain boundaries and route placeholders, to be built in later phases.
