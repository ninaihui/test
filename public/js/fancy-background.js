// 全局炫酷背景效果（渐变 + 发光色块 + 粒子）
// 在任意页面中引入本脚本即可启用：
// <script src="/js/fancy-background.js"></script>

(function () {
  if (typeof window === 'undefined') return;
  if (window.__fancyBackgroundInitialized) return;
  window.__fancyBackgroundInitialized = true;

  const doc = document;
  const head = doc.head || doc.getElementsByTagName('head')[0];
  const body = doc.body || doc.getElementsByTagName('body')[0];
  if (!body) return;

  // 注入样式
  const style = doc.createElement('style');
  style.type = 'text/css';
  style.textContent = `
  @keyframes fancyGradientMove {
    0%   { background-position: 0% 50%; }
    50%  { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }

  body.fancy-bg {
    background:
      radial-gradient(circle at top left, #3b82f6, transparent 55%),
      radial-gradient(circle at bottom right, #ec4899, transparent 55%),
      linear-gradient(-45deg, #020617, #020617, #0f172a, #020617);
    background-size: 200% 200%;
    animation: fancyGradientMove 25s ease infinite;
    min-height: 100vh;
  }

  .fancy-blob {
    position: fixed;
    border-radius: 999px;
    filter: blur(60px);
    opacity: 0.6;
    mix-blend-mode: screen;
    pointer-events: none;
    z-index: 0;
  }
  .fancy-blob-1 {
    width: 360px;
    height: 360px;
    background: #3b82f6;
    top: -80px;
    left: -80px;
  }
  .fancy-blob-2 {
    width: 420px;
    height: 420px;
    background: #8b5cf6;
    bottom: -100px;
    right: -40px;
  }
  .fancy-blob-3 {
    width: 280px;
    height: 280px;
    background: #ec4899;
    top: 45%;
    right: 12%;
  }

  #fancyParticles {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 0;
  }
  `;
  head.appendChild(style);

  // 给 body 加类，避免影响登录页上已有 class
  body.classList.add('fancy-bg');

  // 发光色块：如页面已经有，则不重复创建
  if (!doc.querySelector('.fancy-blob-1')) {
    const blob1 = doc.createElement('div');
    blob1.className = 'fancy-blob fancy-blob-1';
    const blob2 = doc.createElement('div');
    blob2.className = 'fancy-blob fancy-blob-2';
    const blob3 = doc.createElement('div');
    blob3.className = 'fancy-blob fancy-blob-3';
    body.appendChild(blob1);
    body.appendChild(blob2);
    body.appendChild(blob3);
  }

  // 粒子层
  let canvas = doc.getElementById('fancyParticles');
  if (!canvas) {
    canvas = doc.createElement('canvas');
    canvas.id = 'fancyParticles';
    body.appendChild(canvas);
  }

  const ctx = canvas.getContext('2d');
  let width, height;

  function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  // 生成粒子
  const particles = [];
  const COUNT = 45;
  for (let i = 0; i < COUNT; i++) {
    particles.push({
      x: Math.random() * width,
      y: Math.random() * height,
      r: 1 + Math.random() * 2.2,
      dx: -0.35 + Math.random() * 0.7,
      dy: -0.35 + Math.random() * 0.7,
      o: 0.25 + Math.random() * 0.5,
    });
  }

  function draw() {
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    for (const p of particles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(148, 163, 184, ${p.o})`;
      ctx.fill();

      p.x += p.dx;
      p.y += p.dy;

      if (p.x < 0 || p.x > width) p.dx *= -1;
      if (p.y < 0 || p.y > height) p.dy *= -1;
    }
    requestAnimationFrame(draw);
  }

  draw();
})();

