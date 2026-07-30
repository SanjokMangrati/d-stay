import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AuthService } from '@thallesp/nestjs-better-auth';
import { fromNodeHeaders } from 'better-auth/node';
import type { Request } from 'express';
import { UserRole } from '../../generated/prisma/enums';
import { DomainError } from '../errors/domain.error';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedRequest } from './authenticated-request';
import type { Auth } from './auth.factory';

/**
 * The route parameter that makes a route property-scoped. Any route carrying it
 * is authorized by this guard, which is registered globally — that is the point.
 * A new property endpoint is protected because of how it is named, not because
 * whoever wrote it remembered a decorator.
 *
 * The corollary: a property-scoped route must name its parameter `propertyId`.
 * `/properties/:id` would silently skip this check, which is why the
 * authorization suite is parameterised over the registered route table.
 */
export const PROPERTY_ID_PARAM = 'propertyId';

@Injectable()
export class PropertyAccessGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService<Auth>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const propertyId = request.params[PROPERTY_ID_PARAM];
    if (typeof propertyId !== 'string') {
      return true;
    }

    const user = await this.resolveUser(request as AuthenticatedRequest);
    if (!user) {
      throw new DomainError(
        'UNAUTHENTICATED',
        'This request must be signed in.',
      );
    }

    if (user.role === UserRole.ADMIN) {
      return true;
    }

    const membership = await this.prisma.propertyMembership.findFirst({
      where: { userId: user.id, propertyId, isActive: true },
      select: { id: true },
    });

    // A property the host has no membership on is indistinguishable, to them,
    // from one that does not exist — so it reads as absent rather than as
    // forbidden, and no property id can be probed for existence.
    if (!membership) {
      throw new DomainError('NOT_FOUND', 'This property was not found.');
    }

    return true;
  }

  /**
   * Better Auth's guard sets `user` to the session's user or to `null`. Nest
   * does not promise which global guard runs first, so an *undefined* `user`
   * means it has not run yet and the session is resolved here instead —
   * authorization must not depend on registration order.
   */
  private async resolveUser(
    request: AuthenticatedRequest,
  ): Promise<AuthenticatedRequest['user']> {
    if (request.user !== undefined) {
      return request.user;
    }
    const session = await this.auth.api.getSession({
      headers: fromNodeHeaders(request.headers),
    });
    request.user = session?.user ?? null;
    return request.user;
  }
}
