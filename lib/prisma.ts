import { PrismaClient } from "@/lib/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "path";

/**
 * Must match the DB file Prisma Migrate uses (`DATABASE_URL` in `.env`).
 * Previously this was hardcoded to `prisma/dev.db` while migrations used `file:./dev.db`,
 * which pointed at the project root `dev.db` — two different files.
 */
function resolveSqliteFilePath(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    return path.join(process.cwd(), "dev.db");
  }
  let p = url.trim();
  if (p.startsWith("file:")) {
    p = p.slice("file:".length);
  }
  if (p.startsWith("/")) {
    return p;
  }
  if (/^[a-zA-Z]:[\\/]/.test(p)) {
    return path.normalize(p);
  }
  return path.resolve(process.cwd(), p);
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createClient() {
  const adapter = new PrismaBetterSqlite3({ url: resolveSqliteFilePath() });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma || createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
