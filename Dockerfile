FROM node:22-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --production=false

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Generated client is gitignored; must exist before `next build` (imports `@/lib/generated/prisma/client`)
RUN npx prisma generate && npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
# Prisma CLI for `migrate deploy` at container start (not included in Next standalone bundle)
USER root
RUN npm install prisma@7.5.0 --prefix /app --no-save
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
# su-exec: drop root → nextjs after fixing permissions on Docker volume mounts
RUN apk add --no-cache su-exec
# Standalone trace can copy the repo under /app; SQLite + Prisma need a writable tree
RUN chown -R nextjs:nodejs /app
# Entrypoint starts as root, chowns /app/data, then re-execs as nextjs
USER root
EXPOSE 3000
ENV PORT=3000
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "server.js"]
