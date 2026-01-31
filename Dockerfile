# syntax=docker/dockerfile:1

# --- build stage ---
FROM node:20-alpine AS build
WORKDIR /app

# Native deps for bcrypt (and friends)
RUN apk add --no-cache python3 make g++

# Install deps
COPY package*.json ./
RUN npm ci

# Copy source
COPY . .

# Build
RUN npm run build

# --- runtime stage ---
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Native deps for bcrypt (runtime install step)
RUN apk add --no-cache python3 make g++

# Only production deps
COPY package*.json ./
RUN npm ci --omit=dev

# App artifacts
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/public ./public

# Prisma generate at runtime image build time (needs schema + deps)
RUN npx prisma generate --schema=./prisma/schema.prisma

COPY docker/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["./entrypoint.sh"]
