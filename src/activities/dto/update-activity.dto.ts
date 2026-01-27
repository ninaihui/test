import { IsString, IsOptional, IsDateString, MinLength } from 'class-validator';

export class UpdateActivityDto {
  @IsString({ message: '活动名称必须是字符串' })
  @IsOptional()
  @MinLength(2, { message: '活动名称至少需要2个字符' })
  name?: string;

  @IsString({ message: '活动描述必须是字符串' })
  @IsOptional()
  description?: string;

  @IsDateString({}, { message: '活动日期格式不正确' })
  @IsOptional()
  date?: string;

  @IsString({ message: '活动地点必须是字符串' })
  @IsOptional()
  location?: string;
}
