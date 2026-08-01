import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import {
  PropertyRole,
  PropertyStatus,
  UserRole,
} from '../generated/prisma/enums';
import { PROPERTY_ID_PARAM } from '../src/auth/property-access.guard';
import { apiErrorSchema } from '../src/errors/api-error.schema';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  createTestApp,
  signUp,
  truncateAll,
  type SignedInUser,
} from './test-app';
import { registeredRoutes, type RegisteredRoute } from './registered-routes';

const ANONYMOUS_ROUTES = ['/health'];

describe('authorization', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await truncateAll(prisma);
  });

  describe('every route the app registers', () => {
    let routes: RegisteredRoute[];

    beforeAll(() => {
      routes = registeredRoutes(app).filter(
        (route) => !route.path.startsWith('/api/auth'),
      );
    });

    it('was discovered, so the check below is not vacuous', () => {
      expect(routes.map((route) => `${route.method} ${route.path}`)).toEqual(
        expect.arrayContaining(['get /health', 'get /users/me']),
      );
    });

    it('is either declared anonymous or refuses a request without a session', async () => {
      // Parameterised over the route table rather than listed by hand, so an
      // endpoint added without a guard fails here instead of shipping.
      const misprotected: string[] = [];

      for (const route of routes) {
        const response = await request(app.getHttpServer())
          [route.method](placeholderIds(route.path))
          .send({});

        const shouldRefuse = !ANONYMOUS_ROUTES.includes(route.path);
        const didRefuse = response.status === 401;

        if (didRefuse !== shouldRefuse) {
          misprotected.push(`${route.method} ${route.path}`);
        }
      }

      expect(misprotected).toEqual([]);
    });
  });

  describe('a property-scoped route', () => {
    let owner: SignedInUser;
    let propertyId: string;

    beforeEach(async () => {
      owner = await signUp(app);
      const property = await prisma.property.create({
        data: {
          name: 'Deodar House',
          memberships: {
            create: { userId: owner.id, role: PropertyRole.OWNER },
          },
        },
      });
      propertyId = property.id;
    });

    it('lets a member of that property read it', async () => {
      const response = await request(app.getHttpServer())
        .get(`/properties/${propertyId}`)
        .set('cookie', owner.cookie)
        .expect(200);

      expect(response.body).toMatchObject({
        id: propertyId,
        membershipRole: PropertyRole.OWNER,
      });
    });

    it('hides it from a host with no membership', async () => {
      const stranger = await signUp(app);

      const response = await request(app.getHttpServer())
        .get(`/properties/${propertyId}`)
        .set('cookie', stranger.cookie)
        .expect(404);

      const { error } = apiErrorSchema.parse(response.body);
      expect(error.code).toBe('NOT_FOUND');
    });

    it('hides it from a member whose access was revoked', async () => {
      await prisma.propertyMembership.updateMany({
        where: { userId: owner.id, propertyId },
        data: { isActive: false },
      });

      await request(app.getHttpServer())
        .get(`/properties/${propertyId}`)
        .set('cookie', owner.cookie)
        .expect(404);
    });

    it('lets a platform admin read any property', async () => {
      const admin = await signUp(app, { role: UserRole.ADMIN });

      const response = await request(app.getHttpServer())
        .get(`/properties/${propertyId}`)
        .set('cookie', admin.cookie)
        .expect(200);

      expect(response.body).toMatchObject({ membershipRole: null });
    });

    it('refuses a request with no session', async () => {
      const response = await request(app.getHttpServer())
        .get(`/properties/${propertyId}`)
        .expect(401);

      const { error } = apiErrorSchema.parse(response.body);
      expect(error.code).toBe('UNAUTHENTICATED');
    });
  });

  describe('the property list', () => {
    it('shows a host only the properties they are a member of', async () => {
      const [meera, thomas] = await Promise.all([signUp(app), signUp(app)]);
      await prisma.property.create({
        data: {
          name: 'Deodar House',
          memberships: {
            create: { userId: meera.id, role: PropertyRole.OWNER },
          },
        },
      });
      await prisma.property.create({
        data: {
          name: 'Backwater Cottage',
          memberships: {
            create: { userId: thomas.id, role: PropertyRole.OWNER },
          },
        },
      });

      const response = await request(app.getHttpServer())
        .get('/properties')
        .set('cookie', meera.cookie)
        .expect(200);

      expect(response.body).toEqual({
        properties: [
          {
            id: expect.any(String) as string,
            name: 'Deodar House',
            status: PropertyStatus.DRAFT,
            membershipRole: PropertyRole.OWNER,
          },
        ],
      });
    });
  });
});

/**
 * Route patterns carry `:propertyId`; the value is deliberately one that exists
 * nowhere, because this check is about the guard rejecting the caller, not about
 * the row being found.
 */
function placeholderIds(path: string): string {
  return path.replace(
    `:${PROPERTY_ID_PARAM}`,
    '00000000-0000-7000-8000-000000000000',
  );
}
