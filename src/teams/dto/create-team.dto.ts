import { IsString, IsNotEmpty, IsOptional, MinLength } from 'class-validator';

export class CreateTeamDto {
  @IsString({ message: '球队名称必须是字符串' })
  @IsNotEmpty({ message: '球队名称不能为空' })
  @MinLength(2, { message: '球队名称至少需要2个字符' })
  name: string;

  @IsString({ message: '球队描述必须是字符串' })
  @IsOptional()
  description?: string;
}
