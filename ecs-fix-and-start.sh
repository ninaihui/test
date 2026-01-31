#!/bin/bash
# 在 ECS 上执行：安装依赖、构建、启动应用（解决 502）
# 用法：ssh root@47.237.69.93 'bash -s' < ecs-fix-and-start.sh
# 或在 ECS 上：cd /opt/test && bash -c "$(cat ecs-fix-and-start.sh)"

set -e
cd /opt/test

echo ">>> npm install..."
npm install

echo ">>> npm run build..."
npm run build

echo ">>> 停止旧进程..."
pkill -f 'node dist/main' 2>/dev/null || true
sleep 2

echo ">>> 启动应用..."
nohup node dist/main.js > /tmp/team-app.log 2>&1 &
sleep 3

echo ">>> 检查健康..."
curl -s http://127.0.0.1:3000/health && echo " OK" || echo " 失败，看日志: tail -50 /tmp/team-app.log"
