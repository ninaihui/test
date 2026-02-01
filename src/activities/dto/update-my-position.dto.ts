import { IsString, MaxLength } from 'class-validator';

export class UpdateMyPositionDto {
  @IsString()
  @MaxLength(32, { message: '出场位置最多 32 个字符' })
  position: string;
}
