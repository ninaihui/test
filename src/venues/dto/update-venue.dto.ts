import { IsString, IsOptional, MaxLength } from 'class-validator';

export class UpdateVenueDto {
  @IsString({ message: '场地名称必须是字符串' })
  @IsOptional()
  @MaxLength(64, { message: '场地名称最多64个字符' })
  name?: string;

  @IsString({ message: '地址必须是字符串' })
  @IsOptional()
  @MaxLength(200, { message: '地址最多200个字符' })
  address?: string;
}
