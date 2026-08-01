import 'dotenv/config';
import { addDays, parseStayDate, todayStayDate } from '@d-stay/domain/datetime';
import { PrismaPg } from '@prisma/adapter-pg';
import { Queue } from 'bullmq';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { PrismaClient } from '../generated/prisma/client';
import type { Prisma } from '../generated/prisma/client';
import {
  MealPlan,
  MediaStatus,
  PropertyAmenity,
  PropertyRole,
  PropertyStatus,
  RoomAmenity,
  UserRole,
} from '../generated/prisma/enums';
import { createAuth } from '../src/auth/auth.factory';
import { AppConfig } from '../src/config/app-config';
import { originalKey } from '../src/media/media-keys';
import { MediaStorageService } from '../src/media/media-storage.service';
import { MEDIA_QUEUE, type MediaJobData } from '../src/media/media.jobs';

/**
 * The pilot dataset. Today it is only what authorization needs: a platform
 * operator, and two unrelated hosts each owning a property — which is what makes
 * "a host cannot see someone else's property" something you can check by hand as
 * well as in a test. Seasonal rates, bookings across every status and blocks join
 * it as those modules are built.
 *
 * Accounts are created through Better Auth rather than by inserting rows, so the
 * seeded password hashes are the same ones a real sign-up produces.
 */
const SEED_PASSWORD = 'dstay-dev-password';

/**
 * Two hosts, two properties in different places in the review lifecycle: one
 * published, fully filled in and with rooms, one still a draft missing several
 * required fields — which is what makes the setup checklist reviewable without typing a
 * property in by hand.
 */
const HOSTS: {
  email: string;
  name: string;
  phone: string;
  property: Prisma.PropertyCreateWithoutMembershipsInput;
  /** Flat-colour stand-ins, so the photo grid has something in it to review. */
  photoColours: { r: number; g: number; b: number }[];
  rooms: Prisma.RoomCreateWithoutPropertyInput[];
  /** Peak-season rates, positioned relative to today so the calendar is never stale. */
  seasons: {
    rooms: string[];
    startsInDays: number;
    nights: number;
    nightlyRate: number;
    minStayNights: number | null;
  }[];
}[] = [
  {
    email: 'meera@example.com',
    name: 'Meera Rawat',
    phone: '+919876543210',
    property: {
      name: 'Deodar House',
      status: PropertyStatus.PUBLISHED,
      description:
        'A four-room family homestay in a deodar grove above the village, run by the Rawats for two generations.',
      latitude: 30.4599,
      longitude: 78.0664,
      landmark: 'Above the Shiva temple, last house on the ridge road',
      directions:
        'Turn right at the temple and follow the ridge road for 600m. Cars can come all the way up.',
      city: 'Kanatal',
      district: 'Tehri Garhwal',
      state: 'Uttarakhand',
      checkInTime: '12:00',
      checkOutTime: '10:00',
      houseRules:
        'Quiet after 10pm. No smoking indoors. Visitors are welcome until 8pm.',
      amenities: [
        PropertyAmenity.PARKING,
        PropertyAmenity.HOT_WATER,
        PropertyAmenity.WIFI,
        PropertyAmenity.GENERATOR,
        PropertyAmenity.BONFIRE,
      ],
      mealPlan: MealPlan.BREAKFAST_DINNER,
      mealChargePerPerson: 35_000,
      gstEnabled: true,
      gstin: '05ABCDE1234F1Z5',
      homestayRegistrationNumber: 'UK/TG/HS/2023/0412',
    },
    photoColours: [
      { r: 74, g: 94, b: 72 },
      { r: 143, g: 156, b: 128 },
      { r: 196, g: 186, b: 160 },
    ],
    // Named the way the family names them, and deliberately uneven: the calendar
    // and the quote both have to cope with rooms that differ.
    rooms: [
      {
        name: 'Tulsi Room',
        description: 'Ground floor, opens onto the courtyard.',
        doubleBeds: 1,
        singleBeds: 0,
        extraMattresses: 1,
        standardOccupancy: 2,
        maxOccupancy: 3,
        amenities: [RoomAmenity.ATTACHED_BATHROOM, RoomAmenity.HEATER],
        sortOrder: 0,
        baseRate: 250_000,
        weekendRate: 320_000,
        extraGuestCharge: 60_000,
      },
      {
        name: 'Deodar Room',
        description: 'First floor, the one with the valley view.',
        doubleBeds: 1,
        singleBeds: 1,
        extraMattresses: 0,
        standardOccupancy: 3,
        maxOccupancy: 4,
        amenities: [
          RoomAmenity.ATTACHED_BATHROOM,
          RoomAmenity.BALCONY,
          RoomAmenity.HEATER,
        ],
        sortOrder: 1,
        baseRate: 320_000,
        weekendRate: 400_000,
        extraGuestCharge: 60_000,
      },
      {
        name: 'The attic',
        description: 'Low ceiling, two mattresses, the children love it.',
        doubleBeds: 0,
        singleBeds: 2,
        extraMattresses: 2,
        standardOccupancy: 2,
        maxOccupancy: 4,
        amenities: [],
        sortOrder: 2,
        // Priced below the rest and with no weekend premium: the attic is what
        // the family put a young couple in.
        baseRate: 180_000,
        weekendRate: null,
        extraGuestCharge: 40_000,
      },
      {
        name: 'Back room',
        description: 'Out of service until the damp is fixed.',
        doubleBeds: 1,
        singleBeds: 0,
        extraMattresses: 0,
        standardOccupancy: 2,
        maxOccupancy: 2,
        amenities: [RoomAmenity.ATTACHED_BATHROOM],
        sortOrder: 3,
        isActive: false,
        // Out of service and unpriced, so the rates screen has an example of
        // the room it warns about.
        baseRate: null,
      },
    ],
    seasons: [
      {
        rooms: ['Tulsi Room', 'Deodar Room', 'The attic'],
        startsInDays: 60,
        nights: 5,
        nightlyRate: 450_000,
        minStayNights: 2,
      },
    ],
  },
  {
    email: 'thomas@example.com',
    name: 'Thomas Cherian',
    phone: '+919812345678',
    property: {
      name: 'Backwater Cottage',
      status: PropertyStatus.DRAFT,
      description: 'Two rooms on the canal, with a boat jetty of our own.',
      city: 'Kumarakom',
      district: 'Kottayam',
      state: 'Kerala',
      mealPlan: MealPlan.BREAKFAST,
      amenities: [PropertyAmenity.PARKING, PropertyAmenity.HOT_WATER],
    },
    // Left without photos or rooms on purpose: this is the property whose
    // checklist still has entries on it.
    photoColours: [],
    rooms: [],
    seasons: [],
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
const storage = new MediaStorageService(config);
const mediaQueue = new Queue<MediaJobData>(MEDIA_QUEUE, {
  connection: { url: config.redisUrl },
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
    const property = await prisma.property.create({
      data: {
        ...host.property,
        memberships: { create: { userId, role: PropertyRole.OWNER } },
        rooms: { create: host.rooms },
      },
      include: { rooms: { orderBy: { sortOrder: 'asc' } } },
    });

    await seedPhotos(property.id, null, host.photoColours);
    // One room with a photo of its own, so a room gallery is reviewable without
    // uploading by hand.
    for (const room of property.rooms.slice(0, 1)) {
      await seedPhotos(property.id, room.id, [{ r: 108, g: 92, b: 78 }]);
    }

    for (const season of host.seasons) {
      const startDate = addDays(todayStayDate(), season.startsInDays);
      await prisma.rateOverride.createMany({
        data: property.rooms
          .filter((room) => season.rooms.includes(room.name))
          .map((room) => ({
            propertyId: property.id,
            roomId: room.id,
            startDate: parseStayDate(startDate),
            endDate: parseStayDate(addDays(startDate, season.nights - 1)),
            nightlyRate: season.nightlyRate,
            minStayNights: season.minStayNights,
          })),
      });
    }
  }

  console.log(
    `Seeded ${HOSTS.length} hosts and one admin. Every account's password is "${SEED_PASSWORD}".`,
  );
}

/**
 * Writes the objects the way the app does — original into the bucket, row in
 * `PROCESSING`, derivative job on the queue — rather than pretending they are
 * already `READY`. The worker turns them into real derivatives the first time the
 * API runs, so the seeded rows are the same shape as an upload from a phone.
 */
async function seedPhotos(
  propertyId: string,
  roomId: string | null,
  colours: { r: number; g: number; b: number }[],
): Promise<void> {
  for (const [index, background] of colours.entries()) {
    const mediaId = randomUUID();
    const key = originalKey(propertyId, mediaId);
    const body = await sharp({
      create: { width: 1600, height: 1200, channels: 3, background },
    })
      .jpeg({ quality: 80 })
      .toBuffer();

    await storage.putObject(key, body, 'image/jpeg');
    await prisma.mediaAsset.create({
      data: {
        id: mediaId,
        propertyId,
        roomId,
        storageKey: key,
        contentType: 'image/jpeg',
        byteSize: body.length,
        width: 1600,
        height: 1200,
        status: MediaStatus.PROCESSING,
        sortOrder: index,
        isCover: index === 0,
      },
    });
    await mediaQueue.add('derivatives', { kind: 'derivatives', mediaId });
  }
}

main()
  .finally(async () => {
    await mediaQueue.close();
    await prisma.$disconnect();
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
