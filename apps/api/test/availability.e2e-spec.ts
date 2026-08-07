import { GST_SLAB_VERSION } from '@d-stay/domain/pricing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import {
  BookingSource,
  BookingStatus,
  PropertyRole,
  StayKind,
} from '../generated/prisma/enums';
import { apiErrorSchema } from '../src/errors/api-error.schema';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  createTestApp,
  signUp,
  truncateAll,
  type SignedInUser,
} from './test-app';

interface StayListBody {
  stays: {
    id: string;
    roomId: string;
    kind: StayKind;
    checkIn: string;
    checkOut: string;
    reason: string | null;
    bookingId: string | null;
    bookingStatus: string | null;
    guestName: string | null;
  }[];
}

interface FreeRoomsBody {
  checkIn: string;
  checkOut: string;
  roomIds: string[];
}

/** The nights every test in this file argues about. Half-open: three nights. */
const HELD = { checkIn: '2026-11-10', checkOut: '2026-11-13' };

describe('availability', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let owner: SignedInUser;
  let propertyId: string;
  let tulsiRoomId: string;
  let atticId: string;
  let closedRoomId: string;

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
            {
              name: 'Back room',
              standardOccupancy: 2,
              maxOccupancy: 2,
              sortOrder: 2,
              isActive: false,
            },
          ],
        },
      },
      include: { rooms: { orderBy: { sortOrder: 'asc' } } },
    });

    propertyId = property.id;
    [tulsiRoomId, atticId, closedRoomId] = property.rooms.map(
      (room) => room.id,
    );
  });

  const block = (body: object) =>
    request(app.getHttpServer())
      .post(`/properties/${propertyId}/availability/blocks`)
      .set('cookie', owner.cookie)
      .send({ reason: 'Repairs', ...body });

  const readWindow = (from: string, to: string) =>
    request(app.getHttpServer())
      .get(`/properties/${propertyId}/availability`)
      .query({ from, to })
      .set('cookie', owner.cookie);

  const freeRooms = (checkIn: string, checkOut: string) =>
    request(app.getHttpServer())
      .get(`/properties/${propertyId}/availability/free-rooms`)
      .query({ checkIn, checkOut })
      .set('cookie', owner.cookie);

  /**
   * A booked room, written directly: these tests are about what occupancy does
   * to blocks, and going through the bookings endpoint would drag rates, guests
   * and the status machine into a file that is not about any of them.
   */
  const seedBooking = async (
    roomId: string,
    checkIn: string,
    checkOut: string,
  ) => {
    const booking = await prisma.booking.create({
      data: {
        propertyId,
        guestName: 'Meera Rawat',
        guestPhone: '+919876543210',
        guestEmail: null,
        adults: 2,
        children: 0,
        source: BookingSource.PHONE,
        status: BookingStatus.CONFIRMED,
        checkIn: new Date(`${checkIn}T00:00:00.000Z`),
        checkOut: new Date(`${checkOut}T00:00:00.000Z`),
        roomTotal: 0,
        extraGuestTotal: 0,
        mealTotal: 0,
        subtotal: 0,
        taxTotal: 0,
        total: 0,
        gstSlabVersion: GST_SLAB_VERSION,
        createdById: owner.id,
        updatedById: owner.id,
        stays: {
          create: {
            propertyId,
            roomId,
            kind: StayKind.BOOKING,
            checkIn: new Date(`${checkIn}T00:00:00.000Z`),
            checkOut: new Date(`${checkOut}T00:00:00.000Z`),
          },
        },
      },
      include: { stays: true },
    });

    return booking.stays[0];
  };

  describe('blocking dates', () => {
    it('holds a room for the nights the host chose', async () => {
      const response = await block({
        ...HELD,
        roomIds: [tulsiRoomId],
      }).expect(201);

      expect((response.body as StayListBody).stays).toEqual([
        {
          id: expect.any(String) as string,
          roomId: tulsiRoomId,
          kind: StayKind.BLOCK,
          checkIn: '2026-11-10',
          checkOut: '2026-11-13',
          reason: 'Repairs',
          bookingId: null,
          bookingStatus: null,
          guestName: null,
        },
      ]);
    });

    it('closes several rooms in one action', async () => {
      const response = await block({
        ...HELD,
        roomIds: [tulsiRoomId, atticId],
        reason: 'Monsoon',
      }).expect(201);

      expect((response.body as StayListBody).stays).toHaveLength(2);
      expect(await prisma.roomStay.count()).toBe(2);
    });

    it('blocks a room that is out of service, so it stays off the market', async () => {
      await block({ ...HELD, roomIds: [closedRoomId] }).expect(201);
    });

    it('refuses a block that ends before it starts', async () => {
      const response = await block({
        checkIn: '2026-11-13',
        checkOut: '2026-11-10',
        roomIds: [tulsiRoomId],
      }).expect(400);

      expect(apiErrorSchema.parse(response.body).error.code).toBe(
        'VALIDATION_FAILED',
      );
    });

    it('refuses a block covering no nights at all', async () => {
      await block({
        checkIn: '2026-11-10',
        checkOut: '2026-11-10',
        roomIds: [tulsiRoomId],
      }).expect(400);
    });

    it('refuses a room belonging to another property', async () => {
      const other = await prisma.property.create({
        data: {
          name: 'Backwater Cottage',
          memberships: {
            create: { userId: owner.id, role: PropertyRole.OWNER },
          },
          rooms: {
            create: {
              name: 'Canal Room',
              standardOccupancy: 2,
              maxOccupancy: 2,
              sortOrder: 0,
            },
          },
        },
        include: { rooms: true },
      });

      const response = await block({
        ...HELD,
        roomIds: [other.rooms[0].id],
      }).expect(404);

      expect(apiErrorSchema.parse(response.body).error.code).toBe('NOT_FOUND');
    });
  });

  /**
   * The suite that matters most. Double-booking is the failure that makes a host
   * abandon the product, so every shape of overlap is stated here rather than
   * trusted to the one case someone happened to think of.
   */
  describe('overlap', () => {
    beforeEach(async () => {
      await block({ ...HELD, roomIds: [tulsiRoomId] }).expect(201);
    });

    const expectRefused = async (range: object) => {
      const response = await block({ ...range, roomIds: [tulsiRoomId] }).expect(
        409,
      );

      const { error } = apiErrorSchema.parse(response.body);
      expect(error.code).toBe('BOOKING_CONFLICT');
      expect(error.message).toContain('Tulsi Room');
      expect(await prisma.roomStay.count()).toBe(1);
    };

    it('refuses exactly the same nights', () => expectRefused(HELD));

    it('refuses a range overlapping at the start', () =>
      expectRefused({ checkIn: '2026-11-08', checkOut: '2026-11-11' }));

    it('refuses a range overlapping at the end', () =>
      expectRefused({ checkIn: '2026-11-12', checkOut: '2026-11-15' }));

    it('refuses a range contained inside it', () =>
      expectRefused({ checkIn: '2026-11-11', checkOut: '2026-11-12' }));

    it('refuses a range containing it', () =>
      expectRefused({ checkIn: '2026-11-01', checkOut: '2026-11-30' }));

    it('allows a range ending the morning it starts', async () => {
      await block({
        checkIn: '2026-11-07',
        checkOut: '2026-11-10',
        roomIds: [tulsiRoomId],
      }).expect(201);
    });

    it('allows a range starting the morning it ends — same-day turnover', async () => {
      await block({
        checkIn: '2026-11-13',
        checkOut: '2026-11-16',
        roomIds: [tulsiRoomId],
      }).expect(201);
    });

    it('allows the same nights on a different room', async () => {
      await block({ ...HELD, roomIds: [atticId] }).expect(201);

      expect(await prisma.roomStay.count()).toBe(2);
    });

    it('writes nothing when only one of several rooms clashes', async () => {
      await block({ ...HELD, roomIds: [tulsiRoomId, atticId] }).expect(409);

      expect(await prisma.roomStay.count()).toBe(1);
    });

    it('refuses a block over a booking', async () => {
      await seedBooking(atticId, '2026-11-11', '2026-11-14');

      const response = await block({ ...HELD, roomIds: [atticId] }).expect(409);

      expect(apiErrorSchema.parse(response.body).error.code).toBe(
        'BOOKING_CONFLICT',
      );
    });

    it('ignores a stay that no longer occupies the room', async () => {
      const cancelled = await seedBooking(atticId, '2026-11-11', '2026-11-14');
      await prisma.roomStay.update({
        where: { id: cancelled.id },
        data: { occupies: false },
      });

      await block({ ...HELD, roomIds: [atticId] }).expect(201);
    });

    it('lets exactly one of two simultaneous requests for the same nights win', async () => {
      const nights = { checkIn: '2026-12-01', checkOut: '2026-12-04' };

      const results = await Promise.all(
        Array.from({ length: 5 }, () =>
          block({ ...nights, roomIds: [atticId] }),
        ),
      );

      const created = results.filter((result) => result.status === 201);
      expect(created).toHaveLength(1);
      expect(results.filter((result) => result.status === 409)).toHaveLength(4);
      expect(await prisma.roomStay.count({ where: { roomId: atticId } })).toBe(
        1,
      );
    });
  });

  describe('reading a window', () => {
    it('returns the stays that touch it and leaves out the ones that do not', async () => {
      await block({ ...HELD, roomIds: [tulsiRoomId] }).expect(201);
      await block({
        checkIn: '2026-12-20',
        checkOut: '2026-12-22',
        roomIds: [tulsiRoomId],
      }).expect(201);

      const response = await readWindow('2026-11-01', '2026-12-01').expect(200);

      const { stays } = response.body as StayListBody;
      expect(stays).toHaveLength(1);
      expect(stays[0]).toMatchObject(HELD);
    });

    it('includes a stay that only clips the first night of the window', async () => {
      await block({
        checkIn: '2026-10-30',
        checkOut: '2026-11-02',
        roomIds: [tulsiRoomId],
      }).expect(201);

      const response = await readWindow('2026-11-01', '2026-12-01').expect(200);

      expect((response.body as StayListBody).stays).toHaveLength(1);
    });

    it('leaves out a stay ending the morning the window opens', async () => {
      await block({
        checkIn: '2026-10-28',
        checkOut: '2026-11-01',
        roomIds: [tulsiRoomId],
      }).expect(201);

      const response = await readWindow('2026-11-01', '2026-12-01').expect(200);

      expect((response.body as StayListBody).stays).toEqual([]);
    });

    it('refuses a window longer than a year', async () => {
      const response = await readWindow('2026-01-01', '2027-06-01').expect(400);

      expect(apiErrorSchema.parse(response.body).error.code).toBe(
        'VALIDATION_FAILED',
      );
    });
  });

  describe('which rooms are free', () => {
    it('lists every room in service when nothing is held', async () => {
      const response = await freeRooms(HELD.checkIn, HELD.checkOut).expect(200);

      const body = response.body as FreeRoomsBody;
      expect(body.roomIds).toEqual([tulsiRoomId, atticId]);
    });

    it('leaves out a room that is held for part of the range', async () => {
      await block({
        checkIn: '2026-11-12',
        checkOut: '2026-11-13',
        roomIds: [tulsiRoomId],
      }).expect(201);

      const response = await freeRooms(HELD.checkIn, HELD.checkOut).expect(200);

      expect((response.body as FreeRoomsBody).roomIds).toEqual([atticId]);
    });

    it('still lists a room whose stay ends the morning the range begins', async () => {
      await block({
        checkIn: '2026-11-07',
        checkOut: '2026-11-10',
        roomIds: [tulsiRoomId],
      }).expect(201);

      const response = await freeRooms(HELD.checkIn, HELD.checkOut).expect(200);

      expect((response.body as FreeRoomsBody).roomIds).toContain(tulsiRoomId);
    });
  });

  describe('removing a block', () => {
    it('frees the dates back up', async () => {
      const created = await block({
        ...HELD,
        roomIds: [tulsiRoomId],
      }).expect(201);
      const [stay] = (created.body as StayListBody).stays;

      await request(app.getHttpServer())
        .delete(`/properties/${propertyId}/availability/blocks/${stay.id}`)
        .set('cookie', owner.cookie)
        .expect(204);

      await block({ ...HELD, roomIds: [tulsiRoomId] }).expect(201);
    });

    it('refuses to remove a booking through the blocks endpoint', async () => {
      const booking = await seedBooking(atticId, HELD.checkIn, HELD.checkOut);

      const response = await request(app.getHttpServer())
        .delete(`/properties/${propertyId}/availability/blocks/${booking.id}`)
        .set('cookie', owner.cookie)
        .expect(404);

      expect(apiErrorSchema.parse(response.body).error.code).toBe('NOT_FOUND');
      expect(await prisma.roomStay.count()).toBe(1);
    });
  });

  describe('deleting a room', () => {
    const deleteRoom = (roomId: string) =>
      request(app.getHttpServer())
        .delete(`/properties/${propertyId}/rooms/${roomId}`)
        .set('cookie', owner.cookie);

    it('takes the room out with its blocks', async () => {
      await block({ ...HELD, roomIds: [tulsiRoomId] }).expect(201);

      await deleteRoom(tulsiRoomId).expect(200);

      expect(await prisma.roomStay.count()).toBe(0);
    });

    it('keeps a room that has ever been slept in', async () => {
      await seedBooking(tulsiRoomId, HELD.checkIn, HELD.checkOut);

      const response = await deleteRoom(tulsiRoomId).expect(409);

      expect(apiErrorSchema.parse(response.body).error.code).toBe(
        'ROOM_HAS_BOOKINGS',
      );
      expect(await prisma.room.count({ where: { id: tulsiRoomId } })).toBe(1);
    });
  });
});
