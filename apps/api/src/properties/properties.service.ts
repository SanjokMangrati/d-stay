import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import {
  MediaStatus,
  PropertyRole,
  PropertyStatus,
} from '../../generated/prisma/enums';
import { DomainError } from '../errors/domain.error';
import { PrismaService } from '../prisma/prisma.service';
import type {
  PropertyDetailDto,
  PropertyListDto,
  UpdatePropertyDto,
} from './properties.schema';
import {
  missingRequiredFields,
  SUBMITTABLE_STATUSES,
} from './property-completeness';

/**
 * Selected explicitly rather than returning the model, so adding a column never
 * silently appears in a response.
 */
const DETAIL_SELECT = {
  id: true,
  name: true,
  status: true,
  description: true,
  rejectionReason: true,
  latitude: true,
  longitude: true,
  landmark: true,
  directions: true,
  city: true,
  district: true,
  state: true,
  checkInTime: true,
  checkOutTime: true,
  houseRules: true,
  amenities: true,
  mealPlan: true,
  mealChargePerPerson: true,
  gstEnabled: true,
  gstin: true,
  homestayRegistrationNumber: true,
  // Only what the completeness check needs. A presigned upload the host never
  // finished is not a photo, and a photo of one room is not a photo of the
  // property — neither counts towards being reviewable.
  _count: {
    select: {
      media: {
        where: { status: { not: MediaStatus.PENDING }, roomId: null },
      },
      rooms: { where: { isActive: true } },
    },
  },
} satisfies Prisma.PropertySelect;

type PropertyRow = Prisma.PropertyGetPayload<{ select: typeof DETAIL_SELECT }>;

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
      select: {
        role: true,
        property: { select: { id: true, name: true, status: true } },
      },
      orderBy: { property: { name: 'asc' } },
    });

    return {
      properties: memberships.map(({ role, property }) => ({
        id: property.id,
        name: property.name,
        status: property.status,
        membershipRole: role,
      })),
    };
  }

  /**
   * The creating host becomes its owner in the same write — a property without a
   * membership is unreachable by its own creator.
   */
  async create(userId: string, name: string): Promise<PropertyDetailDto> {
    const property = await this.prisma.property.create({
      data: {
        name,
        memberships: { create: { userId, role: PropertyRole.OWNER } },
      },
      select: DETAIL_SELECT,
    });

    return toDetail(property, PropertyRole.OWNER);
  }

  /**
   * Access was already decided by `PropertyAccessGuard`; this only reads. The
   * membership lookup here is for the caller's own role, not for permission.
   */
  async findById(
    propertyId: string,
    userId: string,
  ): Promise<PropertyDetailDto> {
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
      select: {
        ...DETAIL_SELECT,
        memberships: {
          where: { userId, isActive: true },
          select: { role: true },
        },
      },
    });

    if (!property) {
      throw new DomainError('NOT_FOUND', 'This property was not found.');
    }

    return toDetail(property, property.memberships[0]?.role ?? null);
  }

  /**
   * Also the per-step draft save for the setup flow, which is why a partial body
   * is the normal case rather than the exception. Editing is never gated on
   * review status — a published property is still the host's to correct.
   */
  async update(
    propertyId: string,
    userId: string,
    changes: UpdatePropertyDto,
  ): Promise<PropertyDetailDto> {
    try {
      const property = await this.prisma.property.update({
        where: { id: propertyId },
        data: changes,
        select: {
          ...DETAIL_SELECT,
          memberships: {
            where: { userId, isActive: true },
            select: { role: true },
          },
        },
      });

      return toDetail(property, property.memberships[0]?.role ?? null);
    } catch (error) {
      // The guard already proved the property exists for anyone holding a
      // membership; only an admin can reach a missing id, and they get the same
      // answer a host would.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new DomainError('NOT_FOUND', 'This property was not found.');
      }
      throw error;
    }
  }

  /**
   * The completeness check runs inside the transaction against the row being
   * updated, so a concurrent edit that empties a required field cannot slip a
   * half-filled property into the review queue.
   */
  async submitForReview(
    propertyId: string,
    userId: string,
  ): Promise<PropertyDetailDto> {
    await this.prisma.$transaction(async (tx) => {
      const property = await tx.property.findUnique({
        where: { id: propertyId },
        select: DETAIL_SELECT,
      });

      if (!property) {
        throw new DomainError('NOT_FOUND', 'This property was not found.');
      }

      if (!SUBMITTABLE_STATUSES.includes(property.status)) {
        throw new DomainError(
          'INVALID_STATUS_TRANSITION',
          'This property cannot be submitted for review from its current status.',
        );
      }

      const missing = missingRequiredFields({
        ...property,
        photoCount: property._count.media,
        activeRoomCount: property._count.rooms,
      });
      if (missing.length > 0) {
        throw new DomainError(
          'PROPERTY_INCOMPLETE',
          'This property is missing details that review needs.',
          missing.map((field) => ({
            path: field,
            message: 'This is needed before you can submit for review.',
          })),
        );
      }

      await tx.property.update({
        where: { id: propertyId },
        data: {
          status: PropertyStatus.PENDING_REVIEW,
          rejectionReason: null,
        },
      });
    });

    return this.findById(propertyId, userId);
  }
}

function toDetail(
  property: PropertyRow,
  membershipRole: PropertyRole | null,
): PropertyDetailDto {
  // `_count` is how the photo requirement is answered, not something the client
  // is told; it is unpacked here so it cannot leak into the response.
  const { _count, ...fields } = property;

  return {
    ...fields,
    membershipRole,
    missingFields: missingRequiredFields({
      ...fields,
      photoCount: _count.media,
      activeRoomCount: _count.rooms,
    }),
  };
}
