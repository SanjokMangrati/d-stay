import { Injectable } from '@nestjs/common';
import type { UserModel } from '../../generated/prisma/models';
import { DomainError } from '../errors/domain.error';
import { PrismaService } from '../prisma/prisma.service';
import type { UpdateUserProfileDto, UserProfileDto } from './users.schema';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findProfile(userId: string): Promise<UserProfileDto> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    // The session guard already proved this id; a miss means the row was
    // deleted mid-session, and that is a 404 rather than a crash.
    if (!user) {
      throw new DomainError('NOT_FOUND', 'This account no longer exists.');
    }
    return toProfile(user);
  }

  async updateProfile(
    userId: string,
    changes: UpdateUserProfileDto,
  ): Promise<UserProfileDto> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        name: changes.name,
        phone: changes.phone,
        image: changes.avatarUrl,
        locale: changes.locale,
      },
    });
    return toProfile(user);
  }
}

/**
 * The one place a `User` row becomes an API response. Mapping field by field is
 * what keeps a column added for Better Auth's benefit — a password hash, a
 * token — from appearing in the contract because someone spread the model.
 */
function toProfile(user: UserModel): UserProfileDto {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    emailVerified: user.emailVerified,
    role: user.role,
    phone: user.phone,
    phoneVerified: user.phoneVerified,
    avatarUrl: user.image,
    locale: user.locale,
  };
}
