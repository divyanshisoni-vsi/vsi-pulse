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
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function seedPrototypeData() {
  console.log("Seeding exact prototype data into PostgreSQL...");

  // Teams
  const teams = ['Operations', 'Quality', 'Development', 'Catalog', 'Marketing'];
  const teamMap = {};
  for (const name of teams) {
    const t = await prisma.team.upsert({ where: { name }, update: {}, create: { name } });
    teamMap[name] = t.id;
  }

  // Employees
  const defaultPass = await bcrypt.hash('demo1234', 12);
  const rawEmployees = [
    { name: 'Divyanshi Soni', email: 'divyanshi@virtualsolutionsindia.com', team: 'Operations', role: 'Operations & Growth', target: 30, done: 26, status: 'active', accessRole: 'employee' },
    { name: 'Harshita Kansal', email: 'harshita@virtualsolutionsindia.com', team: 'Quality', role: 'Product Tester', target: 25, done: 23, status: 'active', accessRole: 'employee' },
    { name: 'Shruti Shukla', email: 'shruti@virtualsolutionsindia.com', team: 'Quality', role: 'Product QA', target: 40, done: 35, status: 'active', accessRole: 'manager' },
    { name: 'Rohith', email: 'rohith@virtualsolutionsindia.com', team: 'Development', role: 'Web Developer', target: 15, done: 12, status: 'active', accessRole: 'employee' },
    { name: 'Demo Lister', email: 'lister@virtualsolutionsindia.com', team: 'Catalog', role: 'Product Listing', target: 30, done: 21, status: 'active', accessRole: 'employee' }
  ];

  const userMap = {};
  for (const e of rawEmployees) {
    const u = await prisma.user.upsert({
      where: { email: e.email },
      update: {
        name: e.name,
        teamId: teamMap[e.team],
        jobTitle: e.role,
        monthlyTarget: e.target,
        status: e.status
      },
      create: {
        name: e.name,
        email: e.email,
        passwordHash: defaultPass,
        role: e.accessRole,
        teamId: teamMap[e.team],
        jobTitle: e.role,
        monthlyTarget: e.target,
        status: e.status
      }
    });
    userMap[e.email] = u.id;
  }

  // KPIs
  const rawKpis = [
    { team: 'Catalog', name: 'Product listing output', target: 30, weight: 30 },
    { team: 'Quality', name: 'QA accuracy', target: 98, weight: 30 },
    { team: 'Development', name: 'Completed development tasks', target: 15, weight: 25 },
    { team: 'Operations', name: 'Verified operational deliverables', target: 30, weight: 30 }
  ];
  for (const k of rawKpis) {
    const existing = await prisma.kpiStandard.findFirst({ where: { name: k.name, teamId: teamMap[k.team] } });
    if (!existing) {
      await prisma.kpiStandard.create({
        data: {
          teamId: teamMap[k.team],
          name: k.name,
          targetValue: k.target,
          weightPercent: k.weight,
          unit: 'units'
        }
      });
    }
  }

  // Logs
  const rawLogs = [
    { email: 'shruti@virtualsolutionsindia.com', date: '2026-10-29', activity: 'Reviewed 35 product listings; identified 4 corrections', quantity: 35, status: 'verified', source: 'Demo Slack report' },
    { email: 'harshita@virtualsolutionsindia.com', date: '2026-10-29', activity: 'Completed 23 website test cases', quantity: 23, status: 'verified', source: 'Demo Slack report' },
    { email: 'divyanshi@virtualsolutionsindia.com', date: '2026-10-29', activity: 'Reviewed operations SOPs and documented 26 outcomes', quantity: 26, status: 'verified', source: 'Demo Slack report' },
    { email: 'rohith@virtualsolutionsindia.com', date: '2026-10-29', activity: 'Worked on website feature; quantity not provided', quantity: 0, status: 'needs_clarification', source: 'Demo Slack report' }
  ];
  for (const l of rawLogs) {
    const uid = userMap[l.email];
    if (uid) {
      const existing = await prisma.dailyLog.findFirst({ where: { userId: uid, activity: l.activity } });
      if (!existing) {
        await prisma.dailyLog.create({
          data: {
            userId: uid,
            logDate: new Date(l.date),
            activity: l.activity,
            quantity: l.quantity,
            status: l.status,
            source: l.source
          }
        });
      }
    }
  }

  // Attendance
  const rawAtt = [
    { email: 'divyanshi@virtualsolutionsindia.com', date: '2026-10-29', hours: 8, status: 'present' },
    { email: 'harshita@virtualsolutionsindia.com', date: '2026-10-29', hours: 8.5, status: 'present' },
    { email: 'shruti@virtualsolutionsindia.com', date: '2026-10-29', hours: 7.5, status: 'present' },
    { email: 'rohith@virtualsolutionsindia.com', date: '2026-10-29', hours: 0, status: 'leave' }
  ];
  for (const a of rawAtt) {
    const uid = userMap[a.email];
    if (uid) {
      await prisma.attendance.upsert({
        where: { userId_date: { userId: uid, date: new Date(a.date) } },
        update: { hoursWorked: a.hours, status: a.status },
        create: { userId: uid, date: new Date(a.date), hoursWorked: a.hours, status: a.status, source: 'Jibble' }
      });
    }
  }

  // Alerts
  const rawAlerts = [
    { type: 'Incomplete report', text: 'Rohith’s report is missing a measurable quantity.', status: 'open' },
    { type: 'Attendance', text: 'Rohith: leave recorded in demo attendance.', status: 'resolved' }
  ];
  for (const al of rawAlerts) {
    const existing = await prisma.alert.findFirst({ where: { message: al.text } });
    if (!existing) {
      await prisma.alert.create({
        data: { type: al.type, message: al.text, status: al.status }
      });
    }
  }

  console.log("Seeding complete!");
}

seedPrototypeData().catch(console.error).finally(() => prisma.$disconnect());
