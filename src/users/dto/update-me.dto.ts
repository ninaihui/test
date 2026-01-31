import { IsString, IsOptional, MaxLength } from 'class-validator';

export class UpdateMeDto {
  /** 上场位置（如 守门员、中后卫、前锋），空字符串表示清除 */
  @IsString()
  @IsOptional()
  @MaxLength(20, { message: '上场位置最多 20 个字符' })
  playingPosition?: string;
}
