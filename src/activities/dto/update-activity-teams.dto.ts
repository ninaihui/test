import { IsArray, ValidateNested, IsInt, Min, Max, IsString, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

class ActivityTeamAssignmentDto {
  @IsString()
  attendanceId: string;

  @IsInt()
  @Min(0)
  @Max(4)
  teamNo: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(99)
  slotNo?: number;
}

export class UpdateActivityTeamsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ActivityTeamAssignmentDto)
  assignments: ActivityTeamAssignmentDto[];

  // 与 teamCount 对应的阵型数组，例如 ["4-4-2","4-3-3"]
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  formations?: string[];
}
