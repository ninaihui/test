import { IsString, MinLength, MaxLength, IsNotEmpty } from 'class-validator';

export class RegisterDto {
  @IsString({ message: '账号必须是字符串' })
  @IsNotEmpty({ message: '账号不能为空' })
  email: string;

  @IsString({ message: '用户名必须是字符串' })
  @IsNotEmpty({ message: '用户名不能为空' })
  @MinLength(1, { message: '用户名至少1个字符' })
  @MaxLength(10, { message: '用户名最多10个字符' })
  username: string;

  @IsString({ message: '密码必须是字符串' })
  @IsNotEmpty({ message: '密码不能为空' })
  @MinLength(6, { message: '密码至少需要6个字符' })
  password: string;
}
