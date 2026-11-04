import NextAuth from "next-auth";

declare module "next-auth" {
  interface User {
    role: string;
    teamId: string | null;
    teamName: string | null;
  }

  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: string;
      teamId: string | null;
      teamName: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    teamId: string | null;
    teamName: string | null;
  }
}
