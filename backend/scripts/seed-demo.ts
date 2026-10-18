import "dotenv/config";
import { ensureProductionData } from "../src/lib/seedAdmin";
import { prisma } from "../src/lib/prisma";
const url = new URL(process.env.DATABASE_URL || "mongodb://invalid");
if (
    process.env.NODE_ENV !== "test" ||
    !["127.0.0.1", "localhost"].includes(url.hostname) ||
    !/^\/imad_ci_[a-f0-9]{16}$/.test(url.pathname)
)
    throw new Error("Demo seeding requires an isolated imad_ci test database");
ensureProductionData().finally(() => prisma.$disconnect());
