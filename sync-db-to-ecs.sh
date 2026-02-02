#!/bin/bash
# 将本地 PostgreSQL 数据库导出并导入到阿里云 ECS
# 使用前：与 deploy-ecs.sh 保持相同的 ECS 配置；本地需有 pg_dump 或 Docker，ECS 需有 psql 或 Docker，且 .env 中配置好 DATABASE_URL

set -e

# ========== ECS 配置（与 deploy-ecs.sh 保持一致）==========
ECS_HOST="${ECS_HOST:-47.237.69.93}"
ECS_USER="${ECS_USER:-root}"
ECS_APP_PATH="${ECS_APP_PATH:-/opt/test}"
SSH_KEY="${SSH_KEY:-}"
# =========================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"
DUMP_FILE="prisma/db-dump-ecs.sql"

# 1. 读取本地 .env 中的 DATABASE_URL
if [ ! -f .env ]; then
  echo -e "${RED}❌ 未找到 .env，请先配置本地 DATABASE_URL${NC}"
  exit 1
fi
set -a
source .env 2>/dev/null || true
set +a
if [ -z "$DATABASE_URL" ]; then
  echo -e "${RED}❌ .env 中未设置 DATABASE_URL${NC}"
  exit 1
fi
# pg_dump 不支持 URI 中的 ?schema=public，去掉查询参数
DB_URL_STRIP="${DATABASE_URL%%\?*}"

# 2. 本地导出（整库，含 --clean 便于远程覆盖）
echo -e "${BLUE}📤 正在导出本地数据库...${NC}"
if command -v pg_dump &>/dev/null; then
  pg_dump "$DB_URL_STRIP" -Fp --clean --if-exists -f "$DUMP_FILE"
elif command -v docker &>/dev/null; then
  # 无 pg_dump 时用 Docker：从容器连宿主机需把 localhost 改为 host.docker.internal
  DB_URL_FOR_DOCKER="${DB_URL_STRIP/localhost/host.docker.internal}"
  DB_URL_FOR_DOCKER="${DB_URL_FOR_DOCKER/127.0.0.1/host.docker.internal}"
  mkdir -p "$(dirname "$DUMP_FILE")"
  docker run --rm \
    --add-host=host.docker.internal:host-gateway \
    -v "${SCRIPT_DIR}/prisma:/out" \
    -e "PGCONNECT_TIMEOUT=5" \
    postgres:15-alpine \
    pg_dump "$DB_URL_FOR_DOCKER" -Fp --clean --if-exists -f "/out/$(basename "$DUMP_FILE")" || {
    echo -e "${RED}❌ Docker 导出失败。若本机 Postgres 在 Docker 内，请安装 PostgreSQL 客户端后重试。${NC}"
    exit 1
  }
else
  echo -e "${RED}❌ 未找到 pg_dump 和 Docker。请安装 PostgreSQL 客户端或 Docker。${NC}"
  exit 1
fi
echo -e "${GREEN}   已生成 ${DUMP_FILE}${NC}"

# 3. 上传到 ECS
if [ -z "$ECS_HOST" ]; then
  echo -e "${RED}❌ 请设置 ECS_HOST（或编辑本脚本 / deploy-ecs.sh）${NC}"
  exit 1
fi
SSH_OPTS="${SSH_KEY}"
echo -e "${BLUE}📤 上传 dump 到 ECS ${ECS_USER}@${ECS_HOST}:${ECS_APP_PATH}/...${NC}"
rsync -avz -e "ssh $SSH_OPTS" "$DUMP_FILE" "${ECS_USER}@${ECS_HOST}:${ECS_APP_PATH}/${DUMP_FILE}"

# 4. 在 ECS 上使用 .env 中的 DATABASE_URL 导入（有 psql 用 psql，否则用 Docker）
echo -e "${BLUE}🔨 在 ECS 上导入数据库...${NC}"
ssh $SSH_OPTS "${ECS_USER}@${ECS_HOST}" "cd ${ECS_APP_PATH} && \
  if [ ! -f .env ]; then echo '❌ ECS 上未找到 .env'; exit 1; fi; \
  DATABASE_URL=\$(grep -E '^DATABASE_URL=' .env | cut -d= -f2- | tr -d '\"' | tr -d \"'\"); \
  if [ -z \"\$DATABASE_URL\" ]; then echo '❌ ECS .env 中未设置 DATABASE_URL'; exit 1; fi; \
  DB_URL_STRIP=\${DATABASE_URL%%\?*}; \
  DUMP_PATH=\$(pwd)/${DUMP_FILE}; \
  if command -v psql &>/dev/null; then \
    psql \"\$DB_URL_STRIP\" -v ON_ERROR_STOP=1 -f \"\$DUMP_PATH\"; \
  elif command -v docker &>/dev/null; then \
    docker run --rm --network host -v \"\$(pwd)/prisma:/data\" postgres:15-alpine psql \"\$DB_URL_STRIP\" -v ON_ERROR_STOP=1 -f /data/$(basename ${DUMP_FILE}); \
  else \
    echo '❌ ECS 上未找到 psql 或 Docker'; exit 1; \
  fi; \
  rm -f ${DUMP_FILE}; \
  echo '✅ 数据库导入完成'"

echo -e "${GREEN}✅ 本地数据库已同步到 ECS${NC}"
echo -e "${YELLOW}临时文件 ${DUMP_FILE} 已保留，无需可手动删除。${NC}"
