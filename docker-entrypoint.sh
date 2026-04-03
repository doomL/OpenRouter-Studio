#!/bin/sh
set -e

# First run as root (see Dockerfile): ensure volume mount is writable for `nextjs`.
if [ "$(id -u)" = "0" ]; then
  mkdir -p /app/data
  chown -R nextjs:nodejs /app/data
  exec su-exec nextjs "$0" "$@"
fi

cd /app
npx prisma migrate deploy --schema=./prisma/schema.prisma
exec "$@"
