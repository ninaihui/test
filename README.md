# 业余球队管理系统后端 API

## 技术栈

- Node.js 20
- NestJS
- Prisma (Prisma Client 位于 ./generated/prisma)
- PostgreSQL
- JWT 鉴权
- bcrypt 密码加密

## 项目设置

## 生产部署（推荐：Docker）

> 目标：在 ECS 上稳定运行，不依赖本机 Node/pm2。

1) 复制并填写环境变量（生产建议改强密码）：
```bash
cp .env.example .env
```

2) 启动（构建 + 运行）：
```bash
docker compose -f docker-compose.prod.yml up -d --build
```

3) 查看日志：
```bash
docker compose -f docker-compose.prod.yml logs -f api
```

4) 更新代码后重新部署：
```bash
docker compose -f docker-compose.prod.yml up -d --build
```


### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env` 并填写相应的配置：

```bash
cp .env.example .env
```

编辑 `.env` 文件，设置：
- `DATABASE_URL`: PostgreSQL 数据库连接字符串
- `JWT_SECRET`: JWT 密钥（建议使用强随机字符串）

### 3. 初始化数据库

```bash
# 生成 Prisma Client
npm run prisma:generate

# 运行数据库迁移
npm run prisma:migrate
```

### 4. 启动应用

```bash
# 开发模式
npm run start:dev

# 生产模式
npm run build
npm run start:prod
```

## API 接口

### 认证接口

#### POST /auth/register
用户注册

**请求体：**
```json
{
  "email": "user@example.com",
  "username": "username",
  "password": "password123"
}
```

**响应：**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "username": "username",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  },
  "accessToken": "jwt-token"
}
```

#### POST /auth/login
用户登录

**请求体：**
```json
{
  "usernameOrEmail": "username",
  "password": "password123"
}
```

**响应：**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "username": "username",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  },
  "accessToken": "jwt-token"
}
```

#### GET /auth/me
获取当前用户信息（需要鉴权）

**请求头：**
```
Authorization: Bearer <accessToken>
```

**响应：**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "username": "username",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

## 开发命令

```bash
# 启动开发服务器
npm run start:dev

# 构建项目
npm run build

# 运行测试
npm run test

# Prisma 相关命令
npm run prisma:generate  # 生成 Prisma Client
npm run prisma:migrate   # 运行数据库迁移
npm run prisma:studio    # 打开 Prisma Studio
```
