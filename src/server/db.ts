import type { PrismaClient } from "@prisma/client";
import { DEMO_MODE } from "./demo-data";
import { createDemoPrismaClient } from "./demo-prisma";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createRealClient(): PrismaClient {
  // Imported lazily so DEMO_MODE never triggers any @prisma/client runtime
  // initialization (no engine load, no DATABASE_URL read) at all.
  // eslint-disable-next-line
  const { PrismaClient: RealPrismaClient } = require("@prisma/client");
  return new RealPrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma = (DEMO_MODE
  ? (globalForPrisma.prisma as unknown) ?? createDemoPrismaClient()
  : globalForPrisma.prisma ?? createRealClient()) as PrismaClient;

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
