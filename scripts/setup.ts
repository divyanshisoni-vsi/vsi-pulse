/**
 * First-run setup script.
 * Run once to create the admin account and initial teams:
 *   npx tsx scripts/setup.ts
 *
 * You will be prompted for the admin password interactively.
 * All other accounts are created by the admin from within the app.
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import * as readline from "readline";

const prisma = new PrismaClient();

async function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (ans) => { rl.close(); resolve(ans); }));
}

async function main() {
  console.log("VSI Pulse — First-run setup\n");

  // Create default teams
  const teamNames = ["Operations", "Quality", "Development", "Catalog", "Marketing"];
  for (const name of teamNames) {
    await prisma.team.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    console.log(`✓ Team: ${name}`);
  }

  // Create admin account
  const existing = await prisma.user.findUnique({ where: { email: "admin@virtualsolutionsindia.com" } });
  if (existing) {
    console.log("\nAdmin account already exists. Setup complete.");
    return;
  }

  const adminPassword = await prompt("\nSet admin password (min 8 chars): ");
  if (adminPassword.length < 8) {
    console.error("Password too short. Exiting.");
    process.exit(1);
  }

  const hash = await bcrypt.hash(adminPassword, 12);
  await prisma.user.create({
    data: {
      name: "Admin",
      email: "admin@virtualsolutionsindia.com",
      passwordHash: hash,
      role: "admin",
      status: "active",
      monthlyTarget: 0,
    },
  });

  console.log("\n✓ Admin account created: admin@virtualsolutionsindia.com");
  console.log("\nSetup complete. Run `npm run dev` to start the app.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
