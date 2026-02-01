import { IsArray, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class SlotPositionItem {
  @IsString()
  userId: string;

  @IsString()
  @MaxLength(32, { message: '出场位置最多 32 个字符' })
  position: string;
}

export class UpdatePositionsDto {
  /** 按槽位保存的出场位置：userId + 本场位置 */
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SlotPositionItem)
  positions: SlotPositionItem[];
}
