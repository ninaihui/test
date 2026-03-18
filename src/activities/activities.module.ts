import { Module } from '@nestjs/common';
import { ActivitiesService } from './activities.service';
import { ActivitiesController, ActivitiesPublicController } from './activities.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ActivitiesPublicController, ActivitiesController],
  providers: [ActivitiesService],
  exports: [ActivitiesService],
})
export class ActivitiesModule {}
