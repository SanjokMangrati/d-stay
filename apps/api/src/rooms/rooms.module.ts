import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module';
import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';

@Module({
  // For each room's cover thumbnail; photo URLs stay the media module's to build.
  imports: [MediaModule],
  controllers: [RoomsController],
  providers: [RoomsService],
})
export class RoomsModule {}
