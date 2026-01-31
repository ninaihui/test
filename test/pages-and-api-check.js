/**
 * 在「本地服务已启动」时运行，检查每个页面与健康接口是否返回 200。
 * 用法：先执行 npm run start:dev，再在另一终端执行 node test/pages-and-api-check.js
 */
const BASE = process.env.BASE_URL || 'http://localhost:3000';

const pages = [
  '/',
  '/login.html',
  '/register.html',
  '/dashboard.html',
  '/activities.html',
  '/tactics.html',
  '/profile.html',
  '/admin-dashboard.html',
  '/user-dashboard.html',
];

async function check(url) {
  try {
    const res = await fetch(url, { method: 'GET', redirect: 'follow' });
    return { ok: res.ok, status: res.status };
  } catch (e) {
    return { ok: false, status: 0, error: e.message };
  }
}

async function main() {
  console.log('检查地址:', BASE);
  console.log('');

  let failed = 0;
  for (const path of ['/health', ...pages]) {
    const url = BASE + path;
    const { ok, status, error } = await check(url);
    const label = ok ? '✓' : '✗';
    const msg = error ? error : `HTTP ${status}`;
    console.log(`${label} ${path.padEnd(28)} ${msg}`);
    if (!ok) failed++;
  }

  console.log('');
  if (failed === 0) {
    console.log('全部通过。');
  } else {
    console.log(`失败 ${failed} 项，请确认服务已启动: npm run start:dev`);
    process.exit(1);
  }
}

main();
