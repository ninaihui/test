import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * 用于声明接口所需的系统角色，例如：
 * @Roles('super_admin')
 * @Roles('admin', 'super_admin')
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

