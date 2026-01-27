import { IsString, IsOptional, IsIn } from 'class-validator';

export class UpdateAttendanceDto {
  @IsString({ message: '出勤状态必须是字符串' })
  @IsOptional()
  @IsIn(['present', 'absent', 'late'], { message: '出勤状态必须是 present、absent 或 late' })
  status?: string;

  @IsString({ message: '备注必须是字符串' })
  @IsOptional()
  notes?: string;
}
