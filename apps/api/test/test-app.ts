import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { UserRole } from '../generated/prisma/enums';

/** Every table the suite writes to, child-first so truncation order is legal. */
const TABLES = [
  'booking_line_items',
  'room_stays',
  'bookings',
  'rate_overrides',
  'rooms',
  'media_assets',
  'property_memberships',
  'properties',
  'sessions',
  'accounts',
  'verifications',
  'users',
];

export interface TestApp {
  app: INestApplication<App>;
  prisma: PrismaService;
}

/**
 * The application as `main.ts` builds it. `bodyParser: false` in particular is
 * not a detail — Better Auth reads the raw body and reinstates parsing for every
 * other route, so a test app without it is not the app under test.
 */
export async function createTestApp(): Promise<TestApp> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication<INestApplication<App>>({
    bodyParser: false,
  });
  await app.init();

  return { app, prisma: app.get(PrismaService) };
}

export async function truncateAll(prisma: PrismaService): Promise<void> {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${TABLES.map((table) => `"${table}"`).join(', ')} CASCADE`,
  );
}

export interface SignedInUser {
  id: string;
  email: string;
  cookie: string;
}

let accountCounter = 0;

/**
 * Creates an account the way a browser does, so the password hash, the session
 * row and the cookie are all the real thing rather than fixtures that happen to
 * look right.
 */
export async function signUp(
  app: INestApplication<App>,
  overrides: { role?: UserRole } = {},
): Promise<SignedInUser> {
  accountCounter += 1;
  const email = `host-${accountCounter}@example.test`;

  const response = await request(app.getHttpServer())
    .post('/api/auth/sign-up/email')
    .set('origin', 'http://localhost:3000')
    .send({
      email,
      password: 'a-sufficiently-long-password',
      name: `Host ${accountCounter}`,
      phone: '+919876543210',
    })
    .expect(200);

  const cookie = sessionCookieOf(response.headers['set-cookie']);
  const id = (response.body as { user: { id: string } }).user.id;

  if (overrides.role) {
    const prisma = app.get(PrismaService);
    await prisma.user.update({
      where: { id },
      data: { role: overrides.role },
    });
  }

  return { id, email, cookie };
}

function sessionCookieOf(header: string | string[] | undefined): string {
  const cookies = Array.isArray(header) ? header : [header];
  const session = cookies.find((value) =>
    value?.startsWith('better-auth.session_token='),
  );
  if (!session) {
    throw new Error('Sign-up did not set a session cookie.');
  }
  return session.split(';')[0];
}
