/**
 * 登录流程测试：在「本地服务已启动」时运行。
 * 检查：login 页面可访问、注册/登录接口返回正确、登录响应含 accessToken/user（前端可据此跳转）。
 * 用法：先执行 npm run start 或 npm run start:dev，再在另一终端执行 node test/login-flow-check.js
 */
const BASE = process.env.BASE_URL || 'http://localhost:3000';

async function fetchJson(url, options = {}) {
  const res = await fetch(url, { ...options, redirect: 'follow' });
  const text = await res.text();
  let body = {};
  try {
    if (text) body = JSON.parse(text);
  } catch (_) {}
  return { ok: res.ok, status: res.status, body, headers: res.headers };
}

async function main() {
  console.log('登录流程检查，BASE:', BASE);
  console.log('');

  let failed = 0;

  // 1. GET login.html 应返回 200
  const loginPage = await fetch(BASE + '/login.html', { redirect: 'follow' });
  if (!loginPage.ok) {
    console.log('✗ GET /login.html   HTTP', loginPage.status);
    failed++;
  } else {
    console.log('✓ GET /login.html   200');
  }

  // 2. 注册一个测试用户（用户名最多 10 字符）
  const uid = 'u' + String(Date.now()).slice(-9);
  const testUser = { email: uid + '@t.local', username: uid, password: 'test123456' };
  const reg = await fetchJson(BASE + '/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(testUser),
  });
  if (!reg.ok) {
    console.log('✗ POST /auth/register  HTTP', reg.status, reg.body.message || '');
    failed++;
  } else {
    console.log('✓ POST /auth/register  201');
  }

  // 3. POST /auth/login 应返回 201，且 body 含 accessToken 和 user（前端据此跳转）
  const login = await fetchJson(BASE + '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      usernameOrEmail: testUser.username,
      password: testUser.password,
    }),
  });
  if (!login.ok) {
    console.log('✗ POST /auth/login     HTTP', login.status, login.body.message || '');
    failed++;
  } else {
    const hasToken = !!(login.body.accessToken || login.body.access_token);
    const hasUser = !!login.body.user;
    if (hasToken && hasUser) {
      console.log('✓ POST /auth/login     201，含 accessToken 与 user（登录后可跳转）');
    } else {
      console.log('✗ POST /auth/login     响应缺少 accessToken 或 user');
      failed++;
    }
  }

  // 4. GET dashboard.html 可访问（登录后跳转目标）
  const dash = await fetch(BASE + '/dashboard.html', { redirect: 'follow' });
  if (!dash.ok) {
    console.log('✗ GET /dashboard.html  HTTP', dash.status);
    failed++;
  } else {
    console.log('✓ GET /dashboard.html  200');
  }

  console.log('');
  if (failed === 0) {
    console.log('全部通过。登录页正常，登录接口返回正确；请在浏览器打开', BASE + '/login.html', '手动确认登录后是否跳转到首页。');
  } else {
    console.log('失败', failed, '项。请确认：1) 服务已启动 2) 数据库已执行迁移（含 playingPosition）');
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('请求失败:', e.message);
  console.log('请确认服务已启动: npm run start 或 npm run start:dev');
  process.exit(1);
});
