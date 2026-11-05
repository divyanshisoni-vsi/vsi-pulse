import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import bcrypt from "bcryptjs";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  trustHost: true,
  providers: [
    Credentials({
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;
        const normalizedEmail = email.toLowerCase().trim();

        // Strict domain restriction: Only @virtualsolutionsindia.com permitted
        if (!normalizedEmail.endsWith("@virtualsolutionsindia.com")) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: normalizedEmail },
          select: {
            id: true,
            name: true,
            email: true,
            passwordHash: true,
            role: true,
            status: true,
            teamId: true,
            team: { select: { name: true } },
          },
        });

        if (!user || user.status !== "active") return null;

        // Brute-force protection: Max 5 failed login attempts per 15 minutes
        const failCheck = await checkRateLimit(`login-fail:${normalizedEmail}`, 5, 900);
        if (!failCheck.success) {
          console.warn(`[Login Rate Limit] Account ${normalizedEmail} locked for 15 minutes.`);
          return null;
        }

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        // Reset failed counter upon successful login
        prisma.$executeRawUnsafe(
          `DELETE FROM rate_limits WHERE key = $1`,
          `login-fail:${normalizedEmail}`
        ).catch(console.error);

        // Exactly 2 roles: Admin (which is manager/admin) and Employee
        const effectiveRole =
          user.role === "admin" || (user.role as string) === "manager"
            ? "admin"
            : "employee";

        return {
          id: String(user.id),
          name: user.name,
          email: user.email,
          role: effectiveRole,
          teamId: user.teamId ? String(user.teamId) : null,
          teamName: user.team?.name ?? null,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.teamId = (user as any).teamId;
        token.teamName = (user as any).teamName;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = token.role as string;
      session.user.teamId = token.teamId as string | null;
      session.user.teamName = token.teamName as string | null;
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
});
