# d-stay

Turborepo monorepo managed with pnpm.

## Apps

| Path          | Stack                      | Dev port |
| ------------- | -------------------------- | -------- |
| `apps/web`    | Next.js 16 + Tailwind 4 + shadcn (Base UI) | 3000     |
| `apps/admin`  | Next.js 16 (App Router)                    | 3001     |
| `apps/api`    | NestJS 11 + Prisma 7 (PostgreSQL)          | 8080     |
| `apps/mobile` | Expo SDK 57 / React Native                 | Metro    |

## Packages

| Path                  | Contents                                                              |
| --------------------- | --------------------------------------------------------------------- |
| `packages/domain`     | Locale, money (integer paise) and stay-date helpers shared by all apps |
| `packages/api-client` | orval-generated types, TanStack Query hooks, zod schemas and MSW mocks |

## API contract

`apps/api` is the single source of the contract. zod schemas become the OpenAPI
document, which becomes the frontend client:

```sh
pnpm codegen         # apps/api/openapi.json, then the generated client
pnpm codegen:check   # regenerate and fail if the committed output differs
```

Both `openapi.json` and `packages/api-client/src/generated` are committed and are
never edited by hand — change the zod schema and regenerate.

## Configuration

Every environment variable is validated with zod at boot and the process refuses
to start when one is missing or malformed — `apps/api/src/config/env.schema.ts`
and `apps/web/lib/env.ts` are the complete lists. Copy each app's `.env.example`
(`apps/api/.env`, `apps/web/.env.local`) before running anything.

## Database

`apps/api` uses Prisma. Point `DATABASE_URL` at a Postgres instance.

```sh
pnpm --filter api db:generate   # regenerate client into apps/api/generated/prisma
pnpm --filter api db:migrate    # prisma migrate dev
pnpm --filter api db:studio
```

`prisma generate` also runs on `postinstall`.

## Commands

```sh
pnpm install          # install everything
pnpm dev              # run every app in dev mode
pnpm build            # build web, admin, api
pnpm lint             # lint all apps
pnpm check-types      # tsc --noEmit across all apps
pnpm test             # unit tests
pnpm format           # prettier
```

Scope a task to one app with `--filter`:

```sh
pnpm dev --filter web
pnpm build --filter api
```
