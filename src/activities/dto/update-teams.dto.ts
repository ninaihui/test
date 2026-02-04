import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class TeamAssignmentDto {
  @IsString()
  userId: string;

  /** teamNo: 1..N ; null/undefined clears team assignment */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  teamNo?: number;
}

export class UpdateTeamsDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => TeamAssignmentDto)
  assignments: TeamAssignmentDto[];
}
