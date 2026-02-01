import { IsString, IsOptional, MaxLength } from 'class-validator';

export class RegisterActivityDto {
  /** 本次报名的出场位置（可选），如 守门员、中锋 */
  @IsOptional()
  @IsString()
  @MaxLength(32, { message: '出场位置最多 32 个字符' })
  position?: string;
}
