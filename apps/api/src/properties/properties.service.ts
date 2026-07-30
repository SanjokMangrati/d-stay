import { Injectable } from '@nestjs/common';
import { DomainError } from '../errors/domain.error';
import { PrismaService } from '../prisma/prisma.service';
import type { PropertyListDto, PropertySummaryDto } from './properties.schema';

@Injectable()
export class PropertiesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Deliberately membership-scoped even for an admin: this answers "which
   * properties am I working on", which is the switcher. Oversight across every
   * host's property is the admin module's job and a different question.
   */
  async listForUser(userId: string): Promise<PropertyListDto> {
    const memberships = await this.prisma.propertyMembership.findMany({
      where: { userId, isActive: true },
      select: { role: true, property: { select: { id: true, name: true } } },
      orderBy: { property: { name: 'asc' } },
    });

    return {
      properties: memberships.map(({ role, property }) => ({
        id: property.id,
        name: property.name,
        membershipRole: role,
      })),
    };
  }

  /**
   * Access was already decided by `PropertyAccessGuard`; this only reads. The
   * membership lookup here is for the caller's own role, not for permission.
   */
  async findById(
    propertyId: string,
    userId: string,
  ): Promise<PropertySummaryDto> {
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
      select: {
        id: true,
        name: true,
        memberships: {
          where: { userId, isActive: true },
          select: { role: true },
        },
      },
    });

    if (!property) {
      throw new DomainError('NOT_FOUND', 'This property was not found.');
    }

    return {
      id: property.id,
      name: property.name,
      membershipRole: property.memberships[0]?.role ?? null,
    };
  }
}
