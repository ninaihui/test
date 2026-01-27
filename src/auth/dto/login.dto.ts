import { IsString, IsNotEmpty } from 'class-validator';

export class LoginDto {
  @IsString({ message: '用户名或邮箱必须是字符串' })
  @IsNotEmpty({ message: '用户名或邮箱不能为空' })
  usernameOrEmail: string;

  @IsString({ message: '密码必须是字符串' })
  @IsNotEmpty({ message: '密码不能为空' })
  password: string;
}
