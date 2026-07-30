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
| `packages/domain`     | Locale, money (integer paise), phone and stay-date helpers shared by all apps |
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

`apps/api` uses Prisma against the PostgreSQL 17 instance in `docker-compose.yml`.

```sh
docker compose up -d
pnpm --filter api db:migrate    # prisma migrate dev
pnpm --filter api db:seed       # a platform admin and two unrelated hosts
pnpm --filter api db:generate   # regenerate client into apps/api/generated/prisma
pnpm --filter api db:studio
```

`prisma generate` also runs on `postinstall`. `db:reset` drops and rebuilds the
development database — it destroys all local data and never runs anywhere else.

Seeded accounts all use the password `dstay-dev-password`:
`admin@d-stay.in` (ADMIN), `meera@example.com` and `thomas@example.com` (HOST,
one property each).

## Auth and authorization

Better Auth runs inside `apps/api` with the Prisma adapter and is mounted at
`/api/auth`. The browser only ever talks to the Next.js origin: `next.config.ts`
proxies `/api/*` to NestJS, so the session cookie stays first-party and OAuth
callbacks resolve against the origin the host actually loaded.

Email+password and Google sign-in are enabled, along with email verification and
password reset. Until the notifications module exists those links are written to
the API log in development, and sending fails loudly in production.

Two global guards protect every route:

- Better Auth's guard denies any request without a session unless the route
  carries `@AllowAnonymous()` — forgetting a decorator locks a route down rather
  than opening it.
- `PropertyAccessGuard` authorizes any route whose path carries `:propertyId`,
  requiring an active `PropertyMembership` or the global `ADMIN` role. Naming the
  parameter is what applies it; there is no per-route decorator to forget.

`apps/api/test/authorization.e2e-spec.ts` iterates the registered route table, so
an endpoint added without a guard fails a test instead of shipping.

Google OAuth needs a client id and secret in `apps/api/.env` with the authorised
redirect URI `http://localhost:3000/api/auth/callback/google`.

## Commands

```sh
pnpm install          # install everything
pnpm dev              # host web + api (and the packages they build from)
pnpm dev:all          # adds admin and mobile, which are parked scaffolds
pnpm build            # build web, admin, api
pnpm lint             # lint all apps
pnpm check-types      # tsc --noEmit across all apps
pnpm test             # unit tests
pnpm test:e2e         # API integration tests (needs Docker: Testcontainers)
pnpm format           # prettier
```

Scope a task to one app with `--filter`:

```sh
pnpm dev --filter web
pnpm build --filter api
```
