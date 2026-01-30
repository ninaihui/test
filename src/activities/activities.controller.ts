import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { ActivitiesService } from './activities.service';
import { CreateActivityDto } from './dto/create-activity.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('activities')
@UseGuards(JwtAuthGuard)
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  @Post()
  create(@Request() req, @Body() createActivityDto: CreateActivityDto) {
    return this.activitiesService.create(req.user.sub, createActivityDto);
  }

  @Get()
  findAll(
    @Request() req,
    @Query('teamId') teamId?: string,
    @Query('upcoming') upcoming?: string,
  ) {
    const isUpcoming = upcoming === '1' || upcoming === 'true';
    return this.activitiesService.findAll(req.user.sub, teamId, isUpcoming);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    return this.activitiesService.findOne(id, req.user.sub);
  }

  /** 当前用户报名参加该活动 */
  @Post(':id/register')
  register(@Param('id') id: string, @Request() req) {
    return this.activitiesService.register(id, req.user.sub);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Request() req,
    @Body() updateActivityDto: UpdateActivityDto,
  ) {
    return this.activitiesService.update(id, req.user.sub, updateActivityDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req) {
    return this.activitiesService.remove(id, req.user.sub);
  }
}
