const fs = require('fs');
const path = require('path');

// Load .env.local if present
const envLocalPath = path.resolve(__dirname, '..', '.env.local');
if (fs.existsSync(envLocalPath)) {
  const envContent = fs.readFileSync(envLocalPath, 'utf8');
  for (const line of envContent.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  }
}

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function setup() {
  const teams = ['Operations', 'Quality', 'Development', 'Catalog', 'Marketing'];
  for (const name of teams) {
    await prisma.team.upsert({ where: { name }, update: {}, create: { name } });
    console.log('✓ Team:', name);
  }

  const existing = await prisma.user.findUnique({
    where: { email: 'admin@virtualsolutionsindia.com' }
  });

  if (existing) {
    console.log('Admin account already exists. Done.');
    return;
  }

  const hash = await bcrypt.hash('Admin@VSI2026', 12);
  await prisma.user.create({
    data: {
      name: 'Admin',
      email: 'admin@virtualsolutionsindia.com',
      passwordHash: hash,
      role: 'admin',
      status: 'active',
      monthlyTarget: 0
    }
  });

  console.log('\n✓ Admin created.');
  console.log('  Email:    admin@virtualsolutionsindia.com');
  console.log('  Password: Admin@VSI2026');
  console.log('\nChange this password immediately after first login (via edit employee).');
}

setup()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
