import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { PropertyRole } from '../generated/prisma/enums';
import { apiErrorSchema } from '../src/errors/api-error.schema';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  createTestApp,
  signUp,
  truncateAll,
  type SignedInUser,
} from './test-app';

interface PricingBody {
  mealChargePerPerson: number;
  rooms: {
    roomId: string;
    name: string;
    baseRate: number | null;
    weekendRate: number | null;
    extraGuestCharge: number;
  }[];
  overrides: {
    id: string;
    roomId: string;
    startDate: string;
    endDate: string;
    nightlyRate: number;
    minStayNights: number | null;
  }[];
}

const DIWALI = {
  startDate: '2026-11-06',
  endDate: '2026-11-10',
  nightlyRate: 450_000,
  minStayNights: 2,
};

describe('pricing', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let owner: SignedInUser;
  let propertyId: string;
  let tulsiRoomId: string;
  let atticId: string;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await truncateAll(prisma);
    owner = await signUp(app);
    const property = await prisma.property.create({
      data: {
        name: 'Deodar House',
        memberships: { create: { userId: owner.id, role: PropertyRole.OWNER } },
        rooms: {
          create: [
            {
              name: 'Tulsi Room',
              standardOccupancy: 2,
              maxOccupancy: 3,
              sortOrder: 0,
            },
            {
              name: 'The attic',
              standardOccupancy: 2,
              maxOccupancy: 4,
              sortOrder: 1,
            },
          ],
        },
      },
      include: { rooms: { orderBy: { sortOrder: 'asc' } } },
    });

    propertyId = property.id;
    [tulsiRoomId, atticId] = property.rooms.map((room) => room.id);
  });

  const setOverride = (override: object) =>
    request(app.getHttpServer())
      .post(`/properties/${propertyId}/pricing/overrides`)
      .set('cookie', owner.cookie)
      .send(override);

  it('starts with every room unpriced', async () => {
    const response = await request(app.getHttpServer())
      .get(`/properties/${propertyId}/pricing`)
      .set('cookie', owner.cookie)
      .expect(200);

    const body = response.body as PricingBody;
    expect(body.rooms).toHaveLength(2);
    expect(body.rooms[0]).toMatchObject({
      name: 'Tulsi Room',
      baseRate: null,
      weekendRate: null,
      extraGuestCharge: 0,
    });
  });

  it('keeps rates in paise as the host set them', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/properties/${propertyId}/pricing/rooms/${tulsiRoomId}`)
      .set('cookie', owner.cookie)
      .send({
        baseRate: 250_000,
        weekendRate: 320_000,
        extraGuestCharge: 60_000,
      })
      .expect(200);

    expect((response.body as PricingBody).rooms[0]).toMatchObject({
      baseRate: 250_000,
      weekendRate: 320_000,
      extraGuestCharge: 60_000,
    });
  });

  it('clears a weekend rate back to the base rate', async () => {
    await request(app.getHttpServer())
      .patch(`/properties/${propertyId}/pricing/rooms/${tulsiRoomId}`)
      .set('cookie', owner.cookie)
      .send({ baseRate: 250_000, weekendRate: 320_000, extraGuestCharge: 0 })
      .expect(200);

    const response = await request(app.getHttpServer())
      .patch(`/properties/${propertyId}/pricing/rooms/${tulsiRoomId}`)
      .set('cookie', owner.cookie)
      .send({ baseRate: 250_000, weekendRate: null, extraGuestCharge: 0 })
      .expect(200);

    expect((response.body as PricingBody).rooms[0]?.weekendRate).toBeNull();
  });

  it('refuses a negative rate', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/properties/${propertyId}/pricing/rooms/${tulsiRoomId}`)
      .set('cookie', owner.cookie)
      .send({ baseRate: -100, weekendRate: null, extraGuestCharge: 0 })
      .expect(400);

    const { error } = apiErrorSchema.parse(response.body);
    expect(error.code).toBe('VALIDATION_FAILED');
  });

  it('prices a season for several rooms in one action', async () => {
    const response = await setOverride({
      ...DIWALI,
      roomIds: [tulsiRoomId, atticId],
    }).expect(201);

    const { overrides } = response.body as PricingBody;
    expect(overrides).toHaveLength(2);
    expect(overrides[0]).toMatchObject({
      startDate: '2026-11-06',
      endDate: '2026-11-10',
      nightlyRate: 450_000,
      minStayNights: 2,
    });
    expect(overrides.map((override) => override.roomId).sort()).toEqual(
      [tulsiRoomId, atticId].sort(),
    );
  });

  it('refuses a second override overlapping the first on the same room', async () => {
    await setOverride({ ...DIWALI, roomIds: [tulsiRoomId] }).expect(201);

    const response = await setOverride({
      ...DIWALI,
      startDate: '2026-11-10',
      endDate: '2026-11-12',
      roomIds: [tulsiRoomId],
    }).expect(409);

    const { error } = apiErrorSchema.parse(response.body);
    expect(error.code).toBe('RATE_OVERRIDE_CONFLICT');
    expect(error.message).toContain('Tulsi Room');
    expect(await prisma.rateOverride.count()).toBe(1);
  });

  it('allows a season that starts the night after another ends', async () => {
    await setOverride({ ...DIWALI, roomIds: [tulsiRoomId] }).expect(201);

    await setOverride({
      ...DIWALI,
      startDate: '2026-11-11',
      endDate: '2026-11-13',
      roomIds: [tulsiRoomId],
    }).expect(201);

    expect(await prisma.rateOverride.count()).toBe(2);
  });

  it('allows the same nights on a different room', async () => {
    await setOverride({ ...DIWALI, roomIds: [tulsiRoomId] }).expect(201);
    await setOverride({ ...DIWALI, roomIds: [atticId] }).expect(201);

    expect(await prisma.rateOverride.count()).toBe(2);
  });

  it('writes no override at all when one of the rooms clashes', async () => {
    await setOverride({ ...DIWALI, roomIds: [atticId] }).expect(201);

    await setOverride({ ...DIWALI, roomIds: [tulsiRoomId, atticId] }).expect(
      409,
    );

    expect(await prisma.rateOverride.count()).toBe(1);
  });

  it('refuses an override ending before it starts', async () => {
    const response = await setOverride({
      ...DIWALI,
      startDate: '2026-11-10',
      endDate: '2026-11-06',
      roomIds: [tulsiRoomId],
    }).expect(400);

    const { error } = apiErrorSchema.parse(response.body);
    expect(error.code).toBe('VALIDATION_FAILED');
  });

  it('drops back to the base rate when an override is removed', async () => {
    const created = await setOverride({
      ...DIWALI,
      roomIds: [tulsiRoomId],
    }).expect(201);
    const [override] = (created.body as PricingBody).overrides;

    const response = await request(app.getHttpServer())
      .delete(`/properties/${propertyId}/pricing/overrides/${override.id}`)
      .set('cookie', owner.cookie)
      .expect(200);

    expect((response.body as PricingBody).overrides).toEqual([]);
  });

  it('refuses to price a room belonging to another property', async () => {
    const other = await prisma.property.create({
      data: {
        name: 'Backwater Cottage',
        memberships: { create: { userId: owner.id, role: PropertyRole.OWNER } },
      },
    });

    const response = await request(app.getHttpServer())
      .patch(`/properties/${other.id}/pricing/rooms/${tulsiRoomId}`)
      .set('cookie', owner.cookie)
      .send({ baseRate: 100_000, weekendRate: null, extraGuestCharge: 0 })
      .expect(404);

    const { error } = apiErrorSchema.parse(response.body);
    expect(error.code).toBe('NOT_FOUND');
  });

  it('takes a room out with its rates and its seasons', async () => {
    await setOverride({ ...DIWALI, roomIds: [tulsiRoomId] }).expect(201);

    await request(app.getHttpServer())
      .delete(`/properties/${propertyId}/rooms/${tulsiRoomId}`)
      .set('cookie', owner.cookie)
      .expect(200);

    expect(await prisma.rateOverride.count()).toBe(0);
  });

  it('charges meals per person from the property, not the room', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/properties/${propertyId}/pricing`)
      .set('cookie', owner.cookie)
      .send({ mealChargePerPerson: 35_000 })
      .expect(200);

    expect((response.body as PricingBody).mealChargePerPerson).toBe(35_000);
  });
});
