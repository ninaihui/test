import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class RegisterActivityDto {
  /** 本次报名的出场位置（可选），如 守门员、中锋 */
  @IsOptional()
  @IsString()
  @MaxLength(32, { message: '出场位置最多 32 个字符' })
  position?: string;

  /** 分队编号：0=未定；1..teamCount=具体队 */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  teamNo?: number;
}
