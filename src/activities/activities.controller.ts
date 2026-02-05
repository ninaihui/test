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
import { UpdateActivityEditorsDto } from './dto/update-activity-editors.dto';
import { RegisterActivityDto } from './dto/register-activity.dto';
import { UpdatePositionsDto } from './dto/update-positions.dto';
import { UpdateMyPositionDto } from './dto/update-my-position.dto';
import { UpdateTeamsDto } from './dto/update-teams.dto';
import { UpdateLineupDto } from './dto/update-lineup.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('activities')
@UseGuards(JwtAuthGuard)
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  /** 创建活动：网站管理员 或 队长（由网站管理员在 DB 指定） */
  @Post()
  create(@Request() req, @Body() createActivityDto: CreateActivityDto) {
    return this.activitiesService.create(req.user.sub, req.user.role, createActivityDto);
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
    return this.activitiesService.findOne(id, req.user.sub, req.user.role);
  }

  /** 当前用户报名参加该活动，可传 body.position 指定出场位置 */
  @Post(':id/register')
  register(
    @Param('id') id: string,
    @Request() req,
    @Body() dto: RegisterActivityDto,
  ) {
    return this.activitiesService.register(id, req.user.sub, dto?.position, dto?.teamNo);
  }

  /** 当前用户取消报名 */
  @Delete(':id/register')
  unregister(@Param('id') id: string, @Request() req) {
    return this.activitiesService.unregister(id, req.user.sub);
  }

  /** 当前用户保存本场自己的出场位置（普通用户战术板用） */
  @Patch(':id/my-position')
  updateMyPosition(
    @Param('id') id: string,
    @Request() req,
    @Body() dto: UpdateMyPositionDto,
  ) {
    return this.activitiesService.updateMyPosition(id, req.user.sub, dto.position);
  }

  /**
   * 兼容旧接口：保存出场位置（旧战术板/阵容页）。
   * 目前仍保留，但推荐使用 /lineup。
   */
  @Patch(':id/positions')
  updatePositions(
    @Param('id') id: string,
    @Request() req,
    @Body() dto: UpdatePositionsDto,
  ) {
    return this.activitiesService.updatePositions(id, req.user.sub, req.user.role, dto.positions);
  }

  /** 获取阵容（A/B 两套：formation + slot->user） */
  @Get(':id/lineup')
  getLineup(@Param('id') id: string, @Request() req) {
    return this.activitiesService.getLineup(id, req.user.sub, req.user.role);
  }

  /** 保存阵容（A/B 两套：formation + slot->user）。系统管理员 / 活动创建者 / 活动协管可编辑 */
  @Patch(':id/lineup')
  updateLineup(@Param('id') id: string, @Request() req, @Body() dto: UpdateLineupDto) {
    return this.activitiesService.updateLineup(id, req.user.sub, req.user.role, dto);
  }

  /** 获取本活动已报名用户的分队（teamNo）。候补不参与分队；非管理员只读 */
  @Get(':id/teams')
  getTeams(@Param('id') id: string, @Request() req) {
    return this.activitiesService.getTeams(id, req.user.sub, req.user.role);
  }

  /** 批量更新分队：系统管理员 / 活动创建者 / 活动协管（异常通道）可编辑 */
  @Patch(':id/teams')
  updateTeams(
    @Param('id') id: string,
    @Request() req,
    @Body() dto: UpdateTeamsDto,
  ) {
    return this.activitiesService.updateTeams(id, req.user.sub, req.user.role, dto);
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

  /** 异常通道：网站管理员 或 活动创建者（队长）可设置本活动的战术板协管（额外编辑者） */
  @Patch(':id/editors')
  updateEditors(
    @Param('id') id: string,
    @Request() req,
    @Body() dto: UpdateActivityEditorsDto,
  ) {
    return this.activitiesService.updateEditors(id, req.user.sub, req.user.role, dto.editorUserIds);
  }

  /** 仅管理员可删除活动 */
  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'super_admin')
  remove(@Param('id') id: string, @Request() req) {
    return this.activitiesService.remove(id, req.user.sub);
  }
}
