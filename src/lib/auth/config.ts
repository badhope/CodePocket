import NextAuth, { type NextAuthConfig } from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { users, accounts, sessions, verificationTokens } from "@/lib/db/schema";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export const authConfig: NextAuthConfig = {
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: {
    signIn: "/sign-in",
    signOut: "/sign-out",
    error: "/sign-in",
    verifyRequest: "/verify",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;
        const found = await db.query.users.findFirst({ where: eq(users.email, email) });
        if (!found || !found.passwordHash) return null;
        const ok = await bcrypt.compare(password, found.passwordHash);
        if (!ok) return null;
        return {
          id: found.id,
          email: found.email,
          name: found.name,
          image: found.image,
          role: found.role,
        };
      },
    }),
    ...(process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET
      ? [
          GitHub({
            clientId: process.env.AUTH_GITHUB_ID,
            clientSecret: process.env.AUTH_GITHUB_SECRET,
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
    ...(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET
      ? [
          Google({
            clientId: process.env.AUTH_GOOGLE_ID,
            clientSecret: process.env.AUTH_GOOGLE_SECRET,
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const u = user as { id?: string; role?: string };
        if (u.id) (token as Record<string, unknown>).id = u.id;
        (token as Record<string, unknown>).role = u.role ?? "user";
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        const t = token as Record<string, unknown>;
        session.user.id = (t.id as string) ?? "";
        session.user.role = (t.role as string) ?? "user";
      }
      return session;
    },
    async authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const isPublic =
        pathname === "/" ||
        pathname.startsWith("/sign-in") ||
        pathname.startsWith("/sign-up") ||
        pathname.startsWith("/verify") ||
        pathname.startsWith("/api/auth") ||
        pathname.startsWith("/api/health") ||
        pathname.startsWith("/s/") ||
        pathname.startsWith("/_next") ||
        pathname.startsWith("/icons") ||
        pathname.startsWith("/manifest") ||
        pathname === "/sw.js";
      if (isPublic) return true;
      return !!auth;
    },
  },
  trustHost: true,
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);

declare module "next-auth" {
  interface User {
    role?: string;
  }
  interface Session {
    user: {
      id: string;
      role: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}
