import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
};

export const prisma =
    globalForPrisma.prisma ??
    new PrismaClient({
        transactionOptions: { isolationLevel: "Serializable", maxWait: 10000, timeout: 15000 },
        // ORM diagnostics can render arguments containing customer or campaign data.
        // Request failures are reported by the middleware with type/code only.
        log: [],
    });

if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = prisma;
}
