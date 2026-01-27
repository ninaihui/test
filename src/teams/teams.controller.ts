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
}
