import { IsArray, IsIn, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class LineupSlotItem {
  @IsString()
  userId: string;

  @IsString()
  @MaxLength(16)
  slotKey: string;
}

export class UpdateLineupDto {
  @IsString()
  @IsIn(['A', 'B', '1', '2', '3', '4'])
  teamKey: 'A' | 'B' | '1' | '2' | '3' | '4';

  @IsOptional()
  @IsString()
  @MaxLength(16)
  formation?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LineupSlotItem)
  slots: LineupSlotItem[];
}
