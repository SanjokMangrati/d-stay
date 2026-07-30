import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { PropertyRole, UserRole } from '../generated/prisma/enums';
import { createAuth } from '../src/auth/auth.factory';
import { AppConfig } from '../src/config/app-config';

/**
 * The pilot dataset. Today it is only what authorization needs: a platform
 * operator, and two unrelated hosts each owning a property — which is what makes
 * "a host cannot see someone else's property" something you can check by hand as
 * well as in a test. Rooms, seasonal rates, bookings across every status and
 * blocks join it as those modules are built.
 *
 * Accounts are created through Better Auth rather than by inserting rows, so the
 * seeded password hashes are the same ones a real sign-up produces.
 */
const SEED_PASSWORD = 'dstay-dev-password';

const HOSTS = [
  {
    email: 'meera@example.com',
    name: 'Meera Rawat',
    phone: '+919876543210',
    property: 'Deodar House',
  },
  {
    email: 'thomas@example.com',
    name: 'Thomas Cherian',
    phone: '+919812345678',
    property: 'Backwater Cottage',
  },
];

const ADMIN = {
  email: 'admin@d-stay.in',
  name: 'd-stay Operations',
  phone: '+919800000000',
};

const config = new AppConfig();
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: config.databaseUrl }),
});

async function main(): Promise<void> {
  // Seeding on top of existing accounts would fail halfway through on a unique
  // email and leave a partial dataset. Say so instead.
  if ((await prisma.user.count()) > 0) {
    throw new Error(
      'The database already has users. Run `pnpm --filter api db:reset` to reseed from empty.',
    );
  }

  const auth = createAuth(prisma, config, {
    sendEmailVerification: () => {},
    sendPasswordReset: () => {},
  });

  const signUp = async (person: {
    email: string;
    name: string;
    phone: string;
  }): Promise<string> => {
    const { user } = await auth.api.signUpEmail({
      body: {
        email: person.email,
        name: person.name,
        password: SEED_PASSWORD,
        phone: person.phone,
      },
    });
    // Seeded accounts skip the verification email that has nowhere to go.
    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true },
    });
    return user.id;
  };

  const adminId = await signUp(ADMIN);
  await prisma.user.update({
    where: { id: adminId },
    data: { role: UserRole.ADMIN },
  });

  for (const host of HOSTS) {
    const userId = await signUp(host);
    await prisma.property.create({
      data: {
        name: host.property,
        memberships: { create: { userId, role: PropertyRole.OWNER } },
      },
    });
  }

  console.log(
    `Seeded ${HOSTS.length} hosts and one admin. Every account's password is "${SEED_PASSWORD}".`,
  );
}

main()
  .finally(() => prisma.$disconnect())
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
