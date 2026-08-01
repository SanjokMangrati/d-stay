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

const TULSI_ROOM = {
  name: 'Tulsi Room',
  description: 'Ground floor, opens onto the courtyard.',
  doubleBeds: 1,
  singleBeds: 0,
  extraMattresses: 1,
  standardOccupancy: 2,
  maxOccupancy: 3,
  amenities: ['ATTACHED_BATHROOM'],
};

const ATTIC = {
  ...TULSI_ROOM,
  name: 'The attic',
  description: null,
  amenities: [],
};

describe('rooms', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let owner: SignedInUser;
  let propertyId: string;

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
      },
    });
    propertyId = property.id;
  });

  const addRoom = (room: object = TULSI_ROOM) =>
    request(app.getHttpServer())
      .post(`/properties/${propertyId}/rooms`)
      .set('cookie', owner.cookie)
      .send(room);

  it('adds a room at the end of the order', async () => {
    await addRoom().expect(201);
    const second = await addRoom(ATTIC).expect(201);

    expect(second.body).toMatchObject({
      name: 'The attic',
      sortOrder: 1,
      isActive: true,
    });
  });

  it('refuses a maximum occupancy below the standard one', async () => {
    const response = await addRoom({
      ...TULSI_ROOM,
      standardOccupancy: 4,
      maxOccupancy: 2,
    }).expect(400);

    const { error } = apiErrorSchema.parse(response.body);
    expect(error.code).toBe('VALIDATION_FAILED');
  });

  it('puts the rooms in the order the host sent', async () => {
    const first = await addRoom().expect(201);
    const second = await addRoom(ATTIC).expect(201);
    const ids = [second.body, first.body].map(
      (room: { id: string }) => room.id,
    );

    const response = await request(app.getHttpServer())
      .patch(`/properties/${propertyId}/rooms/order`)
      .set('cookie', owner.cookie)
      .send({ roomIds: ids })
      .expect(200);

    expect(
      (response.body as { rooms: { name: string }[] }).rooms.map(
        (room) => room.name,
      ),
    ).toEqual(['The attic', 'Tulsi Room']);
  });

  it('refuses a reorder that does not name every room', async () => {
    const only = await addRoom().expect(201);
    await addRoom(ATTIC).expect(201);

    const response = await request(app.getHttpServer())
      .patch(`/properties/${propertyId}/rooms/order`)
      .set('cookie', owner.cookie)
      .send({ roomIds: [(only.body as { id: string }).id] })
      .expect(400);

    const { error } = apiErrorSchema.parse(response.body);
    expect(error.code).toBe('VALIDATION_FAILED');
  });

  it('leaves a deactivated room in the host list and out of the checklist', async () => {
    const created = await addRoom().expect(201);
    const roomId = (created.body as { id: string }).id;

    await request(app.getHttpServer())
      .patch(`/properties/${propertyId}/rooms/${roomId}`)
      .set('cookie', owner.cookie)
      .send({ ...TULSI_ROOM, isActive: false })
      .expect(200);

    const [rooms, property] = await Promise.all([
      request(app.getHttpServer())
        .get(`/properties/${propertyId}/rooms`)
        .set('cookie', owner.cookie)
        .expect(200),
      request(app.getHttpServer())
        .get(`/properties/${propertyId}`)
        .set('cookie', owner.cookie)
        .expect(200),
    ]);

    expect((rooms.body as { rooms: unknown[] }).rooms).toHaveLength(1);
    expect(
      (property.body as { missingFields: string[] }).missingFields,
    ).toContain('rooms');
  });

  it('refuses to touch a room belonging to another property', async () => {
    const created = await addRoom().expect(201);
    const roomId = (created.body as { id: string }).id;
    const other = await prisma.property.create({
      data: {
        name: 'Backwater Cottage',
        memberships: { create: { userId: owner.id, role: PropertyRole.OWNER } },
      },
    });

    const response = await request(app.getHttpServer())
      .delete(`/properties/${other.id}/rooms/${roomId}`)
      .set('cookie', owner.cookie)
      .expect(404);

    const { error } = apiErrorSchema.parse(response.body);
    expect(error.code).toBe('NOT_FOUND');
    expect(await prisma.room.count({ where: { id: roomId } })).toBe(1);
  });
});
