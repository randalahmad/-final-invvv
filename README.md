# منصة إدارة الابتكار المؤسسي

منصة حوكمة وامتثال لإدارة الابتكار المؤسسي، مبنية على مبدأ: **معيار الامتثال نفسه هو بنية بيانات المنصة** — تُولَّد الأدلة باستمرار من نشاط إدارة الابتكار اليومي بدلًا من جمعها يدويًا قبل التقييم.

> منتج مستقل تمامًا عن أي مشروع آخر (بما في ذلك مشروع «منارة»). الواجهة عربية بالكامل مع دعم RTL.

## المكدّس التقني (Stack)

- **Next.js 14** (App Router) + **TypeScript** (strict) — Modular Monolith
- **PostgreSQL** + **Prisma ORM**
- **Tailwind CSS** + **shadcn/ui** (RTL، خط IBM Plex Sans Arabic)
- **Auth.js (NextAuth v5)** — Credentials للتطوير المحلي، جاهزة لتكامل Microsoft Entra ID
- **Zod** + **React Hook Form** للنماذج
- **TanStack Table** للجداول، **Recharts** للوحات، **dnd-kit** للـ Kanban

## التشغيل المحلي

```bash
npm install                 # تثبيت الاعتماديات (+ prisma generate تلقائيًا)
cp .env.example .env        # ثم عبّئ القيم
npm run db:migrate          # إنشاء مخطط قاعدة البيانات (Prisma migrate)
npm run db:seed             # بيانات أولية (أدوار، صلاحيات، مدير نظام، متطلبات الامتثال)
npm run dev                 # http://localhost:3000
```

بيانات دخول التطوير بعد الـ seed: `admin@innovation.local` / `Admin@12345`.

## الأوامر

| الأمر | الوظيفة |
| --- | --- |
| `npm run dev` | خادم التطوير |
| `npm run build` | بناء الإنتاج (`prisma generate` ثم `next build`) |
| `npm run start` | تشغيل بناء الإنتاج |
| `npm run lint` | فحص ESLint |
| `npm run typecheck` | فحص أنواع TypeScript |
| `npm run db:migrate` / `db:seed` / `db:studio` | أدوات قاعدة البيانات |

## البنية

```
src/
  app/                 مسارات App Router (login، مجموعة (app) المحمية، api/auth)
  components/          ui/ (shadcn) · shared/ · layout/
  modules/             وحدات المجال (auth، solutions، governance، alerts، ...)
  server/              db (Prisma) · authz (الصلاحيات + النطاق)
  lib/ · config/ · types/
prisma/                schema.prisma · seed.ts
```

راجع [`src/modules/README.md`](src/modules/README.md) لحدود الوحدات.

## متغيرات البيئة

- `DATABASE_URL` — سلسلة اتصال PostgreSQL.
- `AUTH_SECRET` — سر Auth.js (`npx auth secret`).
- (لاحقًا) `AUTH_MICROSOFT_ENTRA_ID_*` — لتكامل Entra ID.
