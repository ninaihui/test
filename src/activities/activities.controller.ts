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
import { UpdateActivityTeamsDto } from './dto/update-activity-teams.dto';
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
  findAll(@Request() req, @Query('teamId') teamId?: string) {
    return this.activitiesService.findAll(req.user.sub, teamId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    return this.activitiesService.findOne(id, req.user.sub);
  }

  // 战术板/分队：获取该活动的分队信息与人员列表
  @Get(':id/teams')
  getTeams(@Param('id') id: string, @Request() req) {
    return this.activitiesService.getTeams(id, req.user.sub);
  }

  // 战术板/分队：保存分队结果（仅球队管理员/系统管理员/活动创建者）
  @Patch(':id/teams')
  updateTeams(
    @Param('id') id: string,
    @Request() req,
    @Body() dto: UpdateActivityTeamsDto,
  ) {
    return this.activitiesService.updateTeams(id, req.user.sub, dto);
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
