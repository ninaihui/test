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
} from '@nestjs/common';
import { TeamsService } from './teams.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { AssignNumberDto } from './dto/assign-number.dto';
import { TransferAdminDto } from './dto/transfer-admin.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('teams')
@UseGuards(JwtAuthGuard)
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Post()
  create(@Request() req, @Body() createTeamDto: CreateTeamDto) {
    return this.teamsService.create(req.user.sub, createTeamDto);
  }

  @Get()
  findAll(@Request() req) {
    return this.teamsService.findAll(req.user.sub);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    return this.teamsService.findOne(id, req.user.sub);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Request() req,
    @Body() updateTeamDto: UpdateTeamDto,
  ) {
    return this.teamsService.update(id, req.user.sub, updateTeamDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req) {
    return this.teamsService.remove(id, req.user.sub);
  }

  @Post(':id/members')
  addMember(
    @Param('id') id: string,
    @Request() req,
    @Body() addMemberDto: AddMemberDto,
  ) {
    return this.teamsService.addMember(id, req.user.sub, addMemberDto);
  }

  @Delete(':id/members/:memberId')
  removeMember(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @Request() req,
  ) {
    return this.teamsService.removeMember(id, req.user.sub, memberId);
  }

  // 球队管理员给成员分配号码
  @Patch(':id/members/:memberId/number')
  assignNumber(
    @Param('id') teamId: string,
    @Param('memberId') memberId: string,
    @Request() req,
    @Body() dto: AssignNumberDto,
  ) {
    return this.teamsService.assignNumber(teamId, req.user.sub, memberId, dto.number);
  }

  // 获取球队名单（用于战术板/头像展示）
  @Get(':id/roster')
  roster(@Param('id') teamId: string, @Request() req) {
    return this.teamsService.roster(teamId, req.user.sub);
  }

  // 转移球队管理员（每队一个管理员）
  @Patch(':id/admin')
  transferAdmin(
    @Param('id') teamId: string,
    @Request() req,
    @Body() dto: TransferAdminDto,
  ) {
    return this.teamsService.transferAdmin(teamId, req.user.sub, dto.userId);
  }
}
