import { IsString, IsNotEmpty, IsOptional, IsDateString, MinLength, IsInt, Min, Max, IsArray } from 'class-validator';
import { Type } from 'class-transformer';

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

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1, { message: '活动人数至少 1 人' })
  @Max(40, { message: '活动人数最多 40 人' })
  maxParticipants?: number;

  /** 可选：手动设置分队数。留空则按 maxParticipants 自动推导 */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4)
  teamCount?: number;

  /** 可选：分队名称数组。长度不足会用默认名补齐 */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  teamNames?: string[];

  @IsOptional()
  @IsDateString({}, { message: '报名截止时间格式不正确' })
  deadlineAt?: string;
}
