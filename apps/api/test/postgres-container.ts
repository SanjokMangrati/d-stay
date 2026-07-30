import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const API_ROOT = resolve(__dirname, '..');

/**
 * Jest's global setup and teardown are separate modules in one process, so the
 * running container is handed between them here rather than by exporting a
 * variable neither of them would share.
 */
const CONTAINER_KEY = Symbol.for('d-stay.test.postgres');

type ContainerHost = { [CONTAINER_KEY]?: StartedPostgreSqlContainer };

/**
 * A real PostgreSQL for the whole suite. Nothing about this system's hardest
 * guarantees — the occupancy exclusion constraint, generated columns,
 * transaction behaviour — exists in a mocked Prisma client, so the tests that
 * matter cannot run against one.
 */
export default async function startPostgres(): Promise<void> {
  const container = await new PostgreSqlContainer('postgres:17-alpine').start();
  (globalThis as ContainerHost)[CONTAINER_KEY] = container;

  const databaseUrl = container.getConnectionUri();
  process.env.DATABASE_URL = databaseUrl;

  // The committed migrations are the only way this schema is ever built, so the
  // suite runs against exactly what production will.
  execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
    cwd: API_ROOT,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
}

export async function stopPostgres(): Promise<void> {
  await (globalThis as ContainerHost)[CONTAINER_KEY]?.stop();
}
