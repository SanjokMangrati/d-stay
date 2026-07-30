import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { ZodResponse } from 'nestjs-zod';
import { UpdateUserProfileDto, UserProfileDto } from './users.schema';
import { UsersService } from './users.service';

/**
 * The web app reads its signed-in host from here rather than from Better Auth's
 * session endpoint, so there is exactly one shape for "the current user" and it
 * comes through the generated client like every other response.
 */
@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @ZodResponse({ status: 200, type: UserProfileDto })
  me(@Session() session: UserSession): Promise<UserProfileDto> {
    return this.users.findProfile(session.user.id);
  }

  @Patch('me')
  @ZodResponse({ status: 200, type: UserProfileDto })
  updateMe(
    @Session() session: UserSession,
    @Body() changes: UpdateUserProfileDto,
  ): Promise<UserProfileDto> {
    return this.users.updateProfile(session.user.id, changes);
  }
}
