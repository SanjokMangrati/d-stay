# d-stay

Turborepo monorepo managed with pnpm.

## Apps

| Path          | Stack                      | Dev port |
| ------------- | -------------------------- | -------- |
| `apps/web`    | Next.js 16 + Tailwind 4 + shadcn (Base UI) | 3000     |
| `apps/admin`  | Next.js 16 (App Router)                    | 3001     |
| `apps/api`    | NestJS 11 + Prisma 7 (PostgreSQL)          | 8080     |
| `apps/mobile` | Expo SDK 57 / React Native                 | Metro    |

Shared packages go in `packages/*`.

## Database

`apps/api` uses Prisma. Copy `apps/api/.env.example` to `apps/api/.env` and point
`DATABASE_URL` at a Postgres instance.

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
pnpm format           # prettier
```

Scope a task to one app with `--filter`:

```sh
pnpm dev --filter web
pnpm build --filter api
```
