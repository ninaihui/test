import { IsString, IsNotEmpty, IsOptional, IsInt, Min, Max } from 'class-validator';

export class AddMemberDto {
  @IsString({ message: '用户ID必须是字符串' })
  @IsNotEmpty({ message: '用户ID不能为空' })
  userId: string;

  @IsString({ message: '角色必须是字符串' })
  @IsOptional()
  role?: string; // member, captain, coach

  // 球衣号码（由球队管理员分配）。可在添加时分配，也可后续分配。
  @IsInt()
  @Min(1)
  @Max(99)
  @IsOptional()
  number?: number;
}
