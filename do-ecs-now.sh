#!/bin/bash
# 本机运行：在 ECS 上安装依赖、构建、启动应用（解决 502 / 无反应）
# 在项目根目录执行： chmod +x do-ecs-now.sh && ./do-ecs-now.sh

set -e
ECS_HOST="47.237.69.93"
ECS_USER="root"
ECS_APP_PATH="/opt/test"
SSH_OPTS="-o StrictHostKeyChecking=no -o ConnectTimeout=15"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo ">>> 上传并执行 ECS 启动脚本..."
scp $SSH_OPTS "$SCRIPT_DIR/ecs-fix-and-start.sh" "${ECS_USER}@${ECS_HOST}:/tmp/"
ssh $SSH_OPTS "${ECS_USER}@${ECS_HOST}" "chmod +x /tmp/ecs-fix-and-start.sh && cd ${ECS_APP_PATH} && bash /tmp/ecs-fix-and-start.sh"

echo ""
echo ">>> 若本机能访问 ECS 3000 端口，可测试："
curl -s -o /dev/null -w "    http://${ECS_HOST}:3000/health -> %{http_code}\n" --connect-timeout 5 "http://${ECS_HOST}:3000/health" 2>/dev/null || echo "    (外网未通，请在阿里云安全组放行 3000)"
echo ""
echo ">>> 请在阿里云控制台：安全组 -> 入方向 -> 添加 3000 端口，授权 0.0.0.0/0"
echo ">>> 然后浏览器访问： http://${ECS_HOST}:3000/login.html"
