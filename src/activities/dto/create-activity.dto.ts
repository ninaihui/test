import { IsString, IsNotEmpty, IsOptional, IsDateString, MinLength } from 'class-validator';

export class CreateActivityDto {
  @IsString({ message: '活动名称必须是字符串' })
  @IsNotEmpty({ message: '活动名称不能为空' })
  @MinLength(2, { message: '活动名称至少需要2个字符' })
  name: string;

  @IsString({ message: '活动描述必须是字符串' })
  @IsOptional()
  description?: string;

  @IsDateString({}, { message: '活动日期格式不正确' })
  @IsNotEmpty({ message: '活动日期不能为空' })
  date: string;

  @IsString({ message: '活动地点必须是字符串' })
  @IsOptional()
  location?: string;

  @IsString({ message: '场地ID必须是字符串' })
  @IsOptional()
  venueId?: string;
}
