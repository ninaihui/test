# API 文档

## 基础信息

- 基础 URL: `http://localhost:3000`
- 认证方式: JWT Bearer Token
- 所有需要鉴权的接口都需要在请求头中添加: `Authorization: Bearer <token>`

---

## 认证接口 (Auth)

### POST /auth/register
用户注册

**请求体：**
```json
{
  "email": "user@example.com",
  "username": "testuser",
  "password": "password123"
}
```

**响应：**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "username": "testuser",
    "createdAt": "2026-01-26T...",
    "updatedAt": "2026-01-26T..."
  },
  "accessToken": "jwt-token"
}
```

### POST /auth/login
用户登录

**请求体：**
```json
{
  "usernameOrEmail": "testuser",
  "password": "password123"
}
```

**响应：**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "username": "testuser",
    "createdAt": "2026-01-26T...",
    "updatedAt": "2026-01-26T..."
  },
  "accessToken": "jwt-token"
}
```

### GET /auth/me
获取当前用户信息（需要鉴权）

**响应：**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "username": "testuser",
  "createdAt": "2026-01-26T...",
  "updatedAt": "2026-01-26T..."
}
```

---

## 球队管理接口 (Teams)

### POST /teams
创建球队（需要鉴权）

**请求体：**
```json
{
  "name": "篮球队",
  "description": "我们的篮球队"
}
```

**响应：**
```json
{
  "id": "uuid",
  "name": "篮球队",
  "description": "我们的篮球队",
  "createdAt": "2026-01-26T...",
  "updatedAt": "2026-01-26T...",
  "members": [
    {
      "id": "uuid",
      "userId": "uuid",
      "teamId": "uuid",
      "role": "captain",
      "joinedAt": "2026-01-26T...",
      "user": {
        "id": "uuid",
        "username": "testuser",
        "email": "user@example.com"
      }
    }
  ]
}
```

### GET /teams
获取用户的所有球队（需要鉴权）

**响应：**
```json
[
  {
    "id": "uuid",
    "name": "篮球队",
    "description": "我们的篮球队",
    "createdAt": "2026-01-26T...",
    "updatedAt": "2026-01-26T...",
    "members": [...],
    "_count": {
      "members": 10,
      "activities": 5
    }
  }
]
```

### GET /teams/:id
获取单个球队详情（需要鉴权，必须是球队成员）

**响应：**
```json
{
  "id": "uuid",
  "name": "篮球队",
  "description": "我们的篮球队",
  "members": [...],
  "activities": [...],
  "_count": {
    "members": 10,
    "activities": 5
  }
}
```

### PATCH /teams/:id
更新球队信息（需要鉴权，必须是队长或教练）

**请求体：**
```json
{
  "name": "新队名",
  "description": "新描述"
}
```

### DELETE /teams/:id
删除球队（需要鉴权，必须是队长）

**响应：**
```json
{
  "message": "球队已删除"
}
```

### POST /teams/:id/members
添加球队成员（需要鉴权，必须是队长或教练）

**请求体：**
```json
{
  "userId": "uuid",
  "role": "member"
}
```

**角色选项：** `member`, `captain`, `coach`

### DELETE /teams/:id/members/:memberId
移除球队成员（需要鉴权，必须是队长或教练）

**响应：**
```json
{
  "message": "成员已移除"
}
```

---

## 活动管理接口 (Activities)

### POST /activities
创建活动（需要鉴权）

**请求体：**
```json
{
  "name": "训练活动",
  "description": "每周训练",
  "date": "2026-01-30T18:00:00Z",
  "location": "体育馆",
  "teamId": "uuid" // 可选
}
```

**响应：**
```json
{
  "id": "uuid",
  "name": "训练活动",
  "description": "每周训练",
  "date": "2026-01-30T18:00:00Z",
  "location": "体育馆",
  "createdById": "uuid",
  "teamId": "uuid",
  "createdAt": "2026-01-26T...",
  "updatedAt": "2026-01-26T...",
  "createdBy": {
    "id": "uuid",
    "username": "testuser",
    "email": "user@example.com"
  },
  "team": {
    "id": "uuid",
    "name": "篮球队"
  },
  "_count": {
    "attendances": 0
  }
}
```

### GET /activities
获取活动列表（需要鉴权）

**查询参数：**
- `teamId` (可选): 筛选特定球队的活动
- `upcoming` (可选): 传 `1` 或 `true` 时只返回未开始的活动，按日期升序

**响应：**
```json
[
  {
    "id": "uuid",
    "name": "训练活动",
    "date": "2026-01-30T18:00:00Z",
    "location": "体育馆",
    "createdBy": {...},
    "team": {...},
    "_count": {
      "attendances": 5
    }
  }
]
```

### GET /activities/:id
获取单个活动详情（需要鉴权）。响应含 `venue`（若有关联场地）、`attendances`（含每条记录的 `status`、`position`）。

**响应：**
```json
{
  "id": "uuid",
  "name": "训练活动",
  "description": "每周训练",
  "date": "2026-01-30T18:00:00Z",
  "location": "体育馆",
  "venue": { "id": "uuid", "name": "XX足球公园A场", "address": "..." },
  "createdBy": {...},
  "team": {...},
  "attendances": [
    {
      "id": "uuid",
      "userId": "uuid",
      "activityId": "uuid",
      "status": "registered",
      "position": "前锋",
      "user": {...}
    }
  ]
}
```

### POST /activities/:id/register
当前用户报名参加该活动（需要鉴权，且需为活动所属球队成员或创建者）。创建一条出勤记录，状态为 `registered`（已报名）。

**响应：** 返回创建的出勤记录（含 `user`、`activity`）。

### PATCH /activities/:id
更新活动（需要鉴权，必须是创建者）

**请求体：**
```json
{
  "name": "新活动名称",
  "date": "2026-02-01T18:00:00Z",
  "location": "新地点"
}
```

### DELETE /activities/:id
删除活动（需要鉴权，必须是创建者）

**响应：**
```json
{
  "message": "活动已删除"
}
```

---

## 场地接口 (Venues)

### GET /venues
获取场地列表（需要鉴权）。用于创建活动时选择场地。

**响应：**
```json
[
  { "id": "uuid", "name": "XX足球公园A场", "address": "...", "createdAt": "...", "updatedAt": "..." }
]
```

### POST /venues
新增场地（需要鉴权）。

**请求体：**
```json
{ "name": "XX足球公园A场", "address": "可选地址" }
```

### PATCH /venues/:id
更新场地（需要鉴权）。

### DELETE /venues/:id
删除场地（需要鉴权）。

---

## 出勤管理接口 (Attendance)

### POST /attendance
创建出勤记录（需要鉴权）

**请求体：**
```json
{
  "activityId": "uuid",
  "status": "present", // present, absent, late
  "notes": "准时到达"
}
```

**响应：**
```json
{
  "id": "uuid",
  "userId": "uuid",
  "activityId": "uuid",
  "status": "present",
  "notes": "准时到达",
  "createdAt": "2026-01-26T...",
  "updatedAt": "2026-01-26T...",
  "user": {
    "id": "uuid",
    "username": "testuser",
    "email": "user@example.com"
  },
  "activity": {
    "id": "uuid",
    "name": "训练活动",
    "date": "2026-01-30T18:00:00Z"
  }
}
```

### GET /attendance
获取出勤记录列表（需要鉴权）

**查询参数：**
- `activityId` (可选): 筛选特定活动的出勤记录

**响应：**
```json
[
  {
    "id": "uuid",
    "userId": "uuid",
    "activityId": "uuid",
    "status": "present",
    "notes": "准时到达",
    "user": {...},
    "activity": {...}
  }
]
```

### GET /attendance/statistics
获取出勤统计（需要鉴权）

**查询参数：**
- `teamId` (可选): 筛选特定球队的统计

**响应：**
```json
{
  "total": 20,
  "present": 15,
  "absent": 3,
  "late": 2,
  "rate": "75.00%"
}
```

### GET /attendance/:id
获取单个出勤记录（需要鉴权）

### PATCH /attendance/:id
更新出勤记录（需要鉴权）。记录所有者或活动创建者/球队管理员可修改。**出场位置**仅活动创建者或球队管理员可设置。

**请求体：**
```json
{
  "status": "registered | present | absent | late",
  "position": "出场位置，如 前锋、左后卫",
  "notes": "备注"
}
```

### DELETE /attendance/:id
删除出勤记录（需要鉴权，必须是记录所有者或活动创建者）

**响应：**
```json
{
  "message": "出勤记录已删除"
}
```

---

## 错误响应格式

所有错误响应都遵循以下格式：

```json
{
  "statusCode": 400,
  "message": "错误信息",
  "error": "错误类型"
}
```

### 常见状态码

- `200` - 成功
- `201` - 创建成功
- `400` - 请求错误
- `401` - 未授权（需要登录）
- `403` - 禁止访问（权限不足）
- `404` - 资源不存在
- `409` - 冲突（如重复创建）
- `500` - 服务器错误

---

## 使用示例

### 1. 注册并登录

```bash
# 注册
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "username": "testuser",
    "password": "password123"
  }'

# 登录
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "usernameOrEmail": "testuser",
    "password": "password123"
  }'
```

### 2. 创建球队

```bash
curl -X POST http://localhost:3000/teams \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "篮球队",
    "description": "我们的篮球队"
  }'
```

### 3. 创建活动

```bash
curl -X POST http://localhost:3000/activities \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "训练活动",
    "description": "每周训练",
    "date": "2026-01-30T18:00:00Z",
    "location": "体育馆",
    "teamId": "team-uuid"
  }'
```

### 4. 记录出勤

```bash
curl -X POST http://localhost:3000/attendance \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "activityId": "activity-uuid",
    "status": "present",
    "notes": "准时到达"
  }'
```

---

## 下一步

1. 运行数据库迁移：`npm run prisma:migrate`
2. 重新生成 Prisma Client：`npm run prisma:generate`
3. 启动应用：`npm run start:dev`
4. 测试 API 接口
