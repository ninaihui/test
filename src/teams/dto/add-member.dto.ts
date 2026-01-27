import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class AddMemberDto {
  @IsString({ message: '用户ID必须是字符串' })
  @IsNotEmpty({ message: '用户ID不能为空' })
  userId: string;

  @IsString({ message: '角色必须是字符串' })
  @IsOptional()
  role?: string; // member, captain, coach
}
