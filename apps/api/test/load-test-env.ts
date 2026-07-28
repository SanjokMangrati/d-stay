import { config } from 'dotenv';
import { resolve } from 'node:path';

// The app refuses to boot without valid configuration, so tests must supply it.
// `.env.test` is committed and contains only local, non-secret values.
config({ path: resolve(__dirname, '..', '.env.test'), quiet: true });
