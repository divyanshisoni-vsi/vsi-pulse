const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const idx = t.indexOf('=');
    if (idx !== -1) {
      let v = t.slice(idx + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      process.env[t.slice(0, idx).trim()] = v;
    }
  }
}

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function clearData() {
  console.log("Resetting database to zero data (keeping admin account)...");

  // Delete dependent tables first
  await prisma.dailyLog.deleteMany({});
  console.log("✓ Cleared daily logs (count: 0)");

  await prisma.attendance.deleteMany({});
  console.log("✓ Cleared attendance records (count: 0)");

  await prisma.alert.deleteMany({});
  console.log("✓ Cleared alerts (count: 0)");

  await prisma.auditLog.deleteMany({});
  console.log("✓ Cleared audit logs (count: 0)");

  await prisma.kpiStandard.deleteMany({});
  console.log("✓ Cleared kpi standards (count: 0)");

  // Delete all users except admin
  const deletedUsers = await prisma.user.deleteMany({
    where: {
      email: { not: 'admin@virtualsolutionsindia.com' }
    }
  });
  console.log(`✓ Removed ${deletedUsers.count} non-admin users`);

  console.log("Database reset complete. Zero data state established.");
  await prisma.$disconnect();
}

clearData().catch((err) => {
  console.error("Error clearing data:", err);
  process.exit(1);
});
