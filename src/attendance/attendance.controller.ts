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
import { AttendanceService } from './attendance.service';
import { CreateAttendanceDto } from './dto/create-attendance.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('attendance')
@UseGuards(JwtAuthGuard)
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post()
  create(@Request() req, @Body() createAttendanceDto: CreateAttendanceDto) {
    return this.attendanceService.create(req.user.sub, createAttendanceDto);
  }

  @Get()
  findAll(@Request() req, @Query('activityId') activityId?: string) {
    return this.attendanceService.findAll(req.user.sub, activityId);
  }

  @Get('statistics')
  getStatistics(@Request() req, @Query('teamId') teamId?: string) {
    return this.attendanceService.getStatistics(req.user.sub, teamId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    return this.attendanceService.findOne(id, req.user.sub);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Request() req,
    @Body() updateAttendanceDto: UpdateAttendanceDto,
  ) {
    return this.attendanceService.update(id, req.user.sub, updateAttendanceDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req) {
    return this.attendanceService.remove(id, req.user.sub);
  }
}
