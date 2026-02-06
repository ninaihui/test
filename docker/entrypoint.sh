#!/bin/sh
set -e

# Run DB migrations in production-safe mode.
# If you prefer manual migrations, comment this out.
echo "[entrypoint] Running prisma migrate deploy..."
node ./node_modules/.bin/prisma migrate deploy --schema=./prisma/schema.prisma

# Ensure upload dirs exist (mounted volume may be empty)
mkdir -p ./public/uploads/photos

echo "[entrypoint] Starting app..."
exec node dist/src/main.js
