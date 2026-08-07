import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import {
  BookingStatus,
  PropertyRole,
  StayKind,
} from '../generated/prisma/enums';
import { BookingsService } from '../src/bookings/bookings.service';
import { apiErrorSchema } from '../src/errors/api-error.schema';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  createTestApp,
  signUp,
  truncateAll,
  type SignedInUser,
} from './test-app';

interface BookingBody {
  id: string;
  status: BookingStatus;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  rooms: { roomId: string; name: string }[];
  roomTotal: number;
  extraGuestTotal: number;
  mealTotal: number;
  subtotal: number;
  taxTotal: number;
  total: number;
  overrideTotal: number | null;
  expiresAt: string | null;
  note: string | null;
  cancellationReason: string | null;
  lineItems: {
    roomId: string;
    date: string;
    source: string;
    roomCharge: number;
    extraGuests: number;
    extraGuestCharge: number;
    mealCharge: number;
    tariff: number;
    gstBasisPoints: number;
    taxAmount: number;
  }[];
}

interface BookingListBody {
  bookings: BookingBody[];
}

/** Three nights, half-open, every test in this file argues about them. */
const STAY = { checkIn: '2026-11-10', checkOut: '2026-11-13' };

/** ₹2,000 a night: above the 0% GST slab, below the 18% one. */
const NIGHTLY = 200_000;

describe('bookings', () => {
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
        gstEnabled: true,
        memberships: { create: { userId: owner.id, role: PropertyRole.OWNER } },
        rooms: {
          create: [
            {
              name: 'Tulsi Room',
              standardOccupancy: 2,
              maxOccupancy: 3,
              sortOrder: 0,
              baseRate: NIGHTLY,
              extraGuestCharge: 50_000,
            },
            {
              name: 'The attic',
              standardOccupancy: 2,
              maxOccupancy: 4,
              sortOrder: 1,
              baseRate: NIGHTLY,
            },
            {
              name: 'Back room',
              standardOccupancy: 2,
              maxOccupancy: 2,
              sortOrder: 2,
              isActive: false,
              baseRate: NIGHTLY,
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

  const book = (body: object) =>
    request(app.getHttpServer())
      .post(`/properties/${propertyId}/bookings`)
      .set('cookie', owner.cookie)
      .send({
        guestName: 'Meera Rawat',
        guestPhone: '+919876543210',
        guestEmail: null,
        adults: 2,
        children: 0,
        rooms: [{ roomId: tulsiRoomId, adults: 2, children: 0 }],
        isWholeProperty: false,
        ...STAY,
        source: 'PHONE',
        status: BookingStatus.CONFIRMED,
        note: null,
        overrideTotal: null,
        overrideReason: null,
        ...body,
      });

  const changeStatus = (
    bookingId: string,
    status: string,
    reason: string | null = null,
  ) =>
    request(app.getHttpServer())
      .patch(`/properties/${propertyId}/bookings/${bookingId}/status`)
      .set('cookie', owner.cookie)
      .send({ status, reason });

  const blockDates = (roomId: string, checkIn: string, checkOut: string) =>
    request(app.getHttpServer())
      .post(`/properties/${propertyId}/availability/blocks`)
      .set('cookie', owner.cookie)
      .send({ roomIds: [roomId], checkIn, checkOut, reason: 'Repairs' });

  const errorCode = (body: unknown) => apiErrorSchema.parse(body).error.code;

  describe('taking a booking', () => {
    it('records the guest, the rooms and what the stay costs', async () => {
      const response = await book({}).expect(201);
      const booking = response.body as BookingBody;

      expect(booking.status).toBe(BookingStatus.CONFIRMED);
      expect(booking.rooms).toEqual([
        { roomId: tulsiRoomId, name: 'Tulsi Room' },
      ]);
      // Three nights at ₹2,000, GST at 5% of each night's tariff.
      expect(booking.roomTotal).toBe(600_000);
      expect(booking.taxTotal).toBe(30_000);
      expect(booking.total).toBe(630_000);
    });

    it('holds the rooms it booked, one stay per room', async () => {
      const response = await book({
        adults: 4,
        rooms: [
          { roomId: tulsiRoomId, adults: 2, children: 0 },
          { roomId: atticId, adults: 2, children: 0 },
        ],
      }).expect(201);

      const stays = await prisma.roomStay.findMany({
        where: { bookingId: (response.body as BookingBody).id },
      });
      expect(stays).toHaveLength(2);
      expect(stays.every((stay) => stay.kind === StayKind.BOOKING)).toBe(true);
      expect(stays.every((stay) => stay.occupies)).toBe(true);
    });

    it('writes a line item for every room-night, priced as it stood', async () => {
      const response = await book({}).expect(201);
      const booking = response.body as BookingBody;

      expect(booking.lineItems).toHaveLength(3);
      expect(booking.lineItems[0]).toMatchObject({
        roomId: tulsiRoomId,
        date: '2026-11-10',
        source: 'BASE',
        roomCharge: NIGHTLY,
        gstBasisPoints: 500,
        taxAmount: 10_000,
      });
    });

    it('charges for guests above what the room sleeps as standard', async () => {
      const response = await book({
        adults: 3,
        rooms: [{ roomId: tulsiRoomId, adults: 3, children: 0 }],
      }).expect(201);

      // One head over standard occupancy, ₹500 a night, three nights.
      expect((response.body as BookingBody).extraGuestTotal).toBe(150_000);
    });

    it('prices a season over the room rate for the nights it covers', async () => {
      await prisma.rateOverride.create({
        data: {
          propertyId,
          roomId: tulsiRoomId,
          startDate: new Date('2026-11-10T00:00:00.000Z'),
          endDate: new Date('2026-11-10T00:00:00.000Z'),
          nightlyRate: 300_000,
        },
      });

      const booking = (await book({}).expect(201)).body as BookingBody;

      expect(booking.lineItems[0]).toMatchObject({
        date: '2026-11-10',
        source: 'OVERRIDE',
        roomCharge: 300_000,
      });
      expect(booking.roomTotal).toBe(700_000);
    });

    it('keeps a negotiated price beside what the rates said', async () => {
      const booking = (
        await book({
          overrideTotal: 500_000,
          overrideReason: 'Repeat guest',
        }).expect(201)
      ).body as BookingBody;

      expect(booking.overrideTotal).toBe(500_000);
      expect(booking.total).toBe(630_000);
    });

    it('refuses a negotiated price with no reason recorded', async () => {
      const response = await book({ overrideTotal: 500_000 }).expect(400);
      expect(errorCode(response.body)).toBe('VALIDATION_FAILED');
    });

    it('gives a pencilled-in enquiry an expiry, and a confirmed booking none', async () => {
      const pending = (
        await book({ status: BookingStatus.PENDING }).expect(201)
      ).body as BookingBody;
      const confirmed = (
        await book({
          rooms: [{ roomId: atticId, adults: 2, children: 0 }],
        }).expect(201)
      ).body as BookingBody;

      expect(pending.expiresAt).not.toBeNull();
      expect(confirmed.expiresAt).toBeNull();
    });

    it('refuses a room with no rate for those nights', async () => {
      await prisma.room.update({
        where: { id: tulsiRoomId },
        data: { baseRate: null },
      });

      const response = await book({}).expect(422);
      expect(errorCode(response.body)).toBe('ROOM_NOT_PRICED');
      expect(await prisma.roomStay.count()).toBe(0);
    });

    it('refuses a stay shorter than a season demands', async () => {
      await prisma.rateOverride.create({
        data: {
          propertyId,
          roomId: tulsiRoomId,
          startDate: new Date('2026-11-10T00:00:00.000Z'),
          endDate: new Date('2026-11-13T00:00:00.000Z'),
          nightlyRate: 300_000,
          minStayNights: 5,
        },
      });

      const response = await book({}).expect(422);
      expect(errorCode(response.body)).toBe('MIN_STAY_VIOLATION');
    });

    it('refuses a room that is out of service', async () => {
      const response = await book({
        rooms: [{ roomId: closedRoomId, adults: 2, children: 0 }],
      }).expect(400);

      expect(errorCode(response.body)).toBe('VALIDATION_FAILED');
    });

    it('refuses more guests than the room sleeps', async () => {
      const response = await book({
        adults: 4,
        rooms: [{ roomId: tulsiRoomId, adults: 4, children: 0 }],
      }).expect(400);

      expect(errorCode(response.body)).toBe('VALIDATION_FAILED');
    });

    it('refuses guests in the rooms that do not add up to the booking', async () => {
      const response = await book({
        adults: 3,
        rooms: [{ roomId: tulsiRoomId, adults: 2, children: 0 }],
      }).expect(400);

      expect(errorCode(response.body)).toBe('VALIDATION_FAILED');
    });

    it('takes a whole-property booking across every room in service', async () => {
      const booking = (
        await book({
          isWholeProperty: true,
          adults: 4,
          rooms: [
            { roomId: tulsiRoomId, adults: 2, children: 0 },
            { roomId: atticId, adults: 2, children: 0 },
          ],
        }).expect(201)
      ).body as BookingBody;

      expect(booking.rooms).toHaveLength(2);
    });

    it('refuses a whole-property booking that leaves a room out', async () => {
      const response = await book({ isWholeProperty: true }).expect(400);
      expect(errorCode(response.body)).toBe('VALIDATION_FAILED');
    });
  });

  describe('never double-booking a room', () => {
    beforeEach(async () => {
      await book({}).expect(201);
    });

    it.each([
      ['the same nights exactly', '2026-11-10', '2026-11-13'],
      ['nights overlapping the start', '2026-11-08', '2026-11-11'],
      ['nights overlapping the end', '2026-11-12', '2026-11-15'],
      ['nights inside the stay', '2026-11-11', '2026-11-12'],
      ['nights swallowing the stay', '2026-11-01', '2026-11-30'],
    ])('refuses a second booking for %s', async (_case, checkIn, checkOut) => {
      const response = await book({ checkIn, checkOut }).expect(409);

      expect(errorCode(response.body)).toBe('BOOKING_CONFLICT');
      expect(await prisma.booking.count()).toBe(1);
    });

    it('allows the next guest to arrive the morning the last one leaves', async () => {
      await book({ checkIn: '2026-11-13', checkOut: '2026-11-15' }).expect(201);
    });

    it('allows a guest to leave the morning an existing stay begins', async () => {
      await book({ checkIn: '2026-11-07', checkOut: '2026-11-10' }).expect(201);
    });

    it('refuses a multi-room booking when only one of its rooms is taken', async () => {
      const response = await book({
        adults: 4,
        rooms: [
          { roomId: atticId, adults: 2, children: 0 },
          { roomId: tulsiRoomId, adults: 2, children: 0 },
        ],
      }).expect(409);

      expect(errorCode(response.body)).toBe('BOOKING_CONFLICT');
      // The whole booking is refused: half a family group in half the rooms is
      // not what the host agreed to.
      expect(await prisma.roomStay.count()).toBe(1);
    });

    it('names the room and the nights that are in the way', async () => {
      const response = await book({}).expect(409);

      expect(apiErrorSchema.parse(response.body).error.message).toContain(
        'Tulsi Room',
      );
    });

    it('refuses a booking over dates the host is holding back', async () => {
      await blockDates(atticId, '2026-11-11', '2026-11-12').expect(201);

      const response = await book({
        rooms: [{ roomId: atticId, adults: 2, children: 0 }],
      }).expect(409);

      expect(errorCode(response.body)).toBe('BOOKING_CONFLICT');
    });

    it('refuses a block over dates a guest already has', async () => {
      const response = await blockDates(
        tulsiRoomId,
        '2026-11-11',
        '2026-11-12',
      ).expect(409);

      expect(errorCode(response.body)).toBe('BOOKING_CONFLICT');
    });

    it('lets exactly one of two identical bookings win', async () => {
      const responses = await Promise.all([
        book({ rooms: [{ roomId: atticId, adults: 2, children: 0 }] }),
        book({ rooms: [{ roomId: atticId, adults: 2, children: 0 }] }),
      ]);

      const created = responses.filter((response) => response.status === 201);
      const refused = responses.filter((response) => response.status === 409);
      expect(created).toHaveLength(1);
      expect(refused).toHaveLength(1);
    });
  });

  describe('moving a booking through its life', () => {
    let bookingId: string;

    beforeEach(async () => {
      const response = await book({ status: BookingStatus.PENDING }).expect(
        201,
      );
      bookingId = (response.body as BookingBody).id;
    });

    it('confirms a pencilled-in enquiry and drops its expiry', async () => {
      const response = await changeStatus(bookingId, 'CONFIRMED').expect(200);

      expect((response.body as BookingBody).status).toBe('CONFIRMED');
      expect((response.body as BookingBody).expiresAt).toBeNull();
    });

    it('walks a stay from confirmed through checked out', async () => {
      await changeStatus(bookingId, 'CONFIRMED').expect(200);
      await changeStatus(bookingId, 'CHECKED_IN').expect(200);
      await changeStatus(bookingId, 'CHECKED_OUT').expect(200);
    });

    it.each([
      ['a hold cannot skip straight to checked in', 'CHECKED_IN'],
      ['a hold cannot check out', 'CHECKED_OUT'],
    ])('refuses when %s', async (_case, status) => {
      const response = await changeStatus(bookingId, status).expect(409);
      expect(errorCode(response.body)).toBe('INVALID_STATUS_TRANSITION');
    });

    it('refuses to move a cancelled booking anywhere', async () => {
      await changeStatus(bookingId, 'CANCELLED', 'Guest called off').expect(
        200,
      );

      const response = await changeStatus(bookingId, 'CONFIRMED').expect(409);
      expect(errorCode(response.body)).toBe('INVALID_STATUS_TRANSITION');
    });

    it('gives the nights back when a booking is cancelled', async () => {
      await changeStatus(bookingId, 'CANCELLED', 'Guest called off').expect(
        200,
      );

      const stays = await prisma.roomStay.findMany({ where: { bookingId } });
      expect(stays.every((stay) => stay.occupies)).toBe(false);

      // The record survives, and the room is bookable again.
      expect(await prisma.roomStay.count()).toBe(1);
      await book({}).expect(201);
    });

    it('gives the nights back when a guest never turns up', async () => {
      await changeStatus(bookingId, 'NO_SHOW', 'Never arrived').expect(200);

      await book({}).expect(201);
    });

    it('keeps holding the rooms while a guest is in the house', async () => {
      await changeStatus(bookingId, 'CONFIRMED').expect(200);
      await changeStatus(bookingId, 'CHECKED_IN').expect(200);

      await book({}).expect(409);
    });

    it('frees the rooms once the guest has checked out', async () => {
      await changeStatus(bookingId, 'CONFIRMED').expect(200);
      await changeStatus(bookingId, 'CHECKED_IN').expect(200);
      await changeStatus(bookingId, 'CHECKED_OUT').expect(200);

      await book({}).expect(201);
    });

    it('records why a booking was cancelled', async () => {
      const response = await changeStatus(
        bookingId,
        'CANCELLED',
        'Guest called off',
      ).expect(200);

      expect((response.body as BookingBody).cancellationReason).toBe(
        'Guest called off',
      );
    });
  });

  describe('holds that run out', () => {
    const expire = (bookingId: string) =>
      prisma.booking.update({
        where: { id: bookingId },
        data: { expiresAt: new Date(Date.now() - 1_000) },
      });

    it('gives the rooms back once the hold has run out', async () => {
      const booking = (
        await book({ status: BookingStatus.PENDING }).expect(201)
      ).body as BookingBody;
      await expire(booking.id);

      const released = await app.get(BookingsService).releaseExpiredHolds();

      expect(released).toBe(1);
      const stays = await prisma.roomStay.findMany({
        where: { bookingId: booking.id },
      });
      expect(stays.every((stay) => stay.occupies)).toBe(false);
      await book({}).expect(201);
    });

    it('keeps the record of what the guest asked for', async () => {
      const booking = (
        await book({ status: BookingStatus.PENDING }).expect(201)
      ).body as BookingBody;
      await expire(booking.id);

      await app.get(BookingsService).releaseExpiredHolds();

      const response = await request(app.getHttpServer())
        .get(`/properties/${propertyId}/bookings/${booking.id}`)
        .set('cookie', owner.cookie)
        .expect(200);
      expect((response.body as BookingBody).status).toBe('CANCELLED');
      expect((response.body as BookingBody).cancellationReason).toBe(
        'This hold expired.',
      );
    });

    it('leaves a hold that has not run out alone', async () => {
      const booking = (
        await book({ status: BookingStatus.PENDING }).expect(201)
      ).body as BookingBody;

      expect(await app.get(BookingsService).releaseExpiredHolds()).toBe(0);

      const stays = await prisma.roomStay.findMany({
        where: { bookingId: booking.id },
      });
      expect(stays.every((stay) => stay.occupies)).toBe(true);
    });

    it('leaves the rooms alone when the hold was confirmed first', async () => {
      const booking = (
        await book({ status: BookingStatus.PENDING }).expect(201)
      ).body as BookingBody;
      await expire(booking.id);
      await changeStatus(booking.id, 'CONFIRMED').expect(200);

      expect(await app.get(BookingsService).releaseExpiredHolds()).toBe(0);

      const stays = await prisma.roomStay.findMany({
        where: { bookingId: booking.id },
      });
      expect(stays.every((stay) => stay.occupies)).toBe(true);
      await book({}).expect(409);
    });

    it('releases nothing twice', async () => {
      const booking = (
        await book({ status: BookingStatus.PENDING }).expect(201)
      ).body as BookingBody;
      await expire(booking.id);

      const bookings = app.get(BookingsService);
      expect(await bookings.releaseExpiredHolds()).toBe(1);
      expect(await bookings.releaseExpiredHolds()).toBe(0);
    });
  });

  describe('what a booking is worth later', () => {
    it('does not move a saved total when the room rate changes', async () => {
      const booking = (await book({}).expect(201)).body as BookingBody;

      await prisma.room.update({
        where: { id: tulsiRoomId },
        data: { baseRate: 500_000 },
      });

      const response = await request(app.getHttpServer())
        .get(`/properties/${propertyId}/bookings/${booking.id}`)
        .set('cookie', owner.cookie)
        .expect(200);

      expect((response.body as BookingBody).total).toBe(booking.total);
      expect((response.body as BookingBody).lineItems[0].roomCharge).toBe(
        NIGHTLY,
      );
    });
  });

  describe('finding a booking again', () => {
    beforeEach(async () => {
      await book({}).expect(201);
      await book({
        guestName: 'Thomas Lepcha',
        guestPhone: '+919812345678',
        rooms: [{ roomId: atticId, adults: 2, children: 0 }],
        checkIn: '2026-12-20',
        checkOut: '2026-12-22',
        status: BookingStatus.PENDING,
      }).expect(201);
    });

    const list = (query: object) =>
      request(app.getHttpServer())
        .get(`/properties/${propertyId}/bookings`)
        .query(query)
        .set('cookie', owner.cookie);

    it('lists every booking of the property', async () => {
      const response = await list({}).expect(200);
      expect((response.body as BookingListBody).bookings).toHaveLength(2);
    });

    it('filters by status', async () => {
      const response = await list({ status: 'PENDING' }).expect(200);

      const { bookings } = response.body as BookingListBody;
      expect(bookings).toHaveLength(1);
      expect(bookings[0].status).toBe('PENDING');
    });

    it('finds the bookings whose stay touches a window', async () => {
      const response = await list({
        from: '2026-11-01',
        to: '2026-12-01',
      }).expect(200);

      const { bookings } = response.body as BookingListBody;
      expect(bookings).toHaveLength(1);
      expect(bookings[0].checkIn).toBe('2026-11-10');
    });

    it('finds a returning guest by name', async () => {
      const response = await list({ search: 'thomas' }).expect(200);
      expect((response.body as BookingListBody).bookings).toHaveLength(1);
    });

    it('finds a returning guest by the digits of their phone', async () => {
      const response = await list({ search: '9812345678' }).expect(200);
      expect((response.body as BookingListBody).bookings).toHaveLength(1);
    });

    it('does not return another property’s bookings', async () => {
      const stranger = await signUp(app);
      const other = await prisma.property.create({
        data: {
          name: 'Someone else',
          memberships: {
            create: { userId: stranger.id, role: PropertyRole.OWNER },
          },
        },
      });

      const response = await request(app.getHttpServer())
        .get(`/properties/${other.id}/bookings`)
        .set('cookie', stranger.cookie)
        .expect(200);

      expect((response.body as BookingListBody).bookings).toEqual([]);
    });
  });

  describe('the private note', () => {
    it('keeps what the host wrote about the arrival', async () => {
      const booking = (await book({}).expect(201)).body as BookingBody;

      const response = await request(app.getHttpServer())
        .patch(`/properties/${propertyId}/bookings/${booking.id}/note`)
        .set('cookie', owner.cookie)
        .send({ note: 'Arriving late, needs a pickup from the bus stand.' })
        .expect(200);

      expect((response.body as BookingBody).note).toBe(
        'Arriving late, needs a pickup from the bus stand.',
      );
    });
  });
});
