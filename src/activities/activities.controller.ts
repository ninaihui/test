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
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('activities')
@UseGuards(JwtAuthGuard)
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  /** 仅管理员可创建活动 */
  @Post()
  @UseGuards(RolesGuard)
  @Roles('admin', 'super_admin')
  create(@Request() req, @Body() createActivityDto: CreateActivityDto) {
    return this.activitiesService.create(req.user.sub, createActivityDto);
  }

  @Get()
  findAll(
    @Request() req,
    @Query('upcoming') upcoming?: string,
  ) {
    const isUpcoming = upcoming === '1' || upcoming === 'true';
    return this.activitiesService.findAll(req.user.sub, isUpcoming);
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

  /** 当前用户取消报名 */
  @Delete(':id/register')
  unregister(@Param('id') id: string, @Request() req) {
    return this.activitiesService.unregister(id, req.user.sub);
  }

  /** 仅管理员可编辑活动 */
  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'super_admin')
  update(
    @Param('id') id: string,
    @Request() req,
    @Body() updateActivityDto: UpdateActivityDto,
  ) {
    return this.activitiesService.update(id, req.user.sub, updateActivityDto, req.user.role);
  }

  /** 仅管理员可删除活动 */
  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'super_admin')
  remove(@Param('id') id: string, @Request() req) {
    return this.activitiesService.remove(id, req.user.sub);
  }
}
