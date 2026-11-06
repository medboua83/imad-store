// Run against this deployment only; no history reconstruction or external calls.
const { purgeExpiredAnalytics } = require('../backend/dist/lib/store-analytics.js');
const { prisma } = require('../backend/dist/lib/prisma.js');
purgeExpiredAnalytics().catch(() => {
  console.error('Analytics retention failed'); process.exitCode = 1;
}).finally(() => prisma.$disconnect());
