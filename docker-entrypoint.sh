#!/bin/sh
set -e
cd /app
npx prisma migrate deploy --schema=./prisma/schema.prisma
exec "$@"
