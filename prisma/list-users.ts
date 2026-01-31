/**
 * 列出数据库中所有用户及其系统角色
 * 运行: npx ts-node -r tsconfig-paths/register prisma/list-users.ts
 * 或: npm run prisma:list-users（若已配置）
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, username: true, role: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  console.log('\n=== 数据库用户与权限 ===\n');
  console.log('系统角色说明:');
  console.log('  user         - 普通用户：不能创建活动，战术板仅可查看');
  console.log('  admin        - 管理员：可创建活动、编辑战术板、创建普通用户等');
  console.log('  super_admin  - 超级管理员：可创建管理员账户等\n');
  console.log(`共 ${users.length} 个账户:\n`);

  const roleCount: Record<string, number> = {};
  users.forEach((u) => {
    roleCount[u.role] = (roleCount[u.role] || 0) + 1;
  });

  users.forEach((u, i) => {
    console.log(`${i + 1}. ${u.username} (${u.email})  role=${u.role}  id=${u.id}`);
  });

  console.log('\n按角色统计:', roleCount);
  console.log('');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
