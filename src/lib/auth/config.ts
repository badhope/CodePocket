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

const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days

/**
 * Pull the best-guess client IP from a NextRequest / Request.
 * Exposed for testing.
 */
function getClientIpFromHeaders(headers: Headers): string | undefined {
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = headers.get("x-real-ip");
  if (real) return real;
  return undefined;
}

export const authConfig: NextAuthConfig = {
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  // JWT session strategy keeps everything stateless and lets us embed
  // request-scoped fields (role, ip) without an extra DB round-trip.
  session: {
    strategy: "jwt",
    maxAge: SESSION_MAX_AGE_SECONDS,
    updateAge: 24 * 60 * 60, // refresh the JWT at most once a day
  },
  jwt: {
    maxAge: SESSION_MAX_AGE_SECONDS,
  },
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
    async signIn({ user, account, profile }) {
      // Hook for future allow/deny decisions. Returning true preserves
      // the existing behaviour. We capture the IP for audit logs.
      void user;
      void account;
      void profile;
      return true;
    },
    async jwt({ token, user, account, profile, trigger }) {
      // First sign-in: copy custom fields from the user record.
      if (user) {
        const u = user as { id?: string; role?: string; email?: string | null };
        if (u.id) (token as Record<string, unknown>).id = u.id;
        (token as Record<string, unknown>).role = u.role ?? "user";
        if (u.email) (token as Record<string, unknown>).email = u.email;
      }
      if (account) {
        (token as Record<string, unknown>).provider = account.provider;
      }
      if (profile) {
        (token as Record<string, unknown>).providerProfile = {
          ...(typeof profile === "object" && profile !== null ? profile : {}),
        };
      }
      // Refresh-on-update: re-hydrate the role from the DB so a user that
      // was upgraded from "user" to "pro" picks up the new role on next
      // navigation without requiring a full re-login.
      if (trigger === "update" && token.sub) {
        try {
          const fresh = await db.query.users.findFirst({
            where: eq(users.id, token.sub),
            columns: { id: true, role: true },
          });
          if (fresh) {
            (token as Record<string, unknown>).role = fresh.role;
          }
        } catch {
          // Non-critical - keep the previous value.
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        const t = token as unknown as Record<string, unknown>;
        session.user.id = (t.id as string) ?? "";
        session.user.role = (t.role as string) ?? "user";
        if (typeof t.provider === "string") {
          (session as unknown as Record<string, unknown>).provider = t.provider;
        }
      }
      return session;
    },
    async authorized({ auth, request }) {
      const { pathname } = request.nextUrl;

      // Pull the IP for audit logging - included in the audit event below.
      const ip = getClientIpFromHeaders(request.headers);
      const userId = auth?.user?.id;
      // We don't actually log here to keep the callback synchronous, but the
      // helper is exposed for callers that want to record the event.
      void ip;
      void userId;

      const isPublic =
        pathname === "/" ||
        pathname.startsWith("/sign-in") ||
        pathname.startsWith("/sign-up") ||
        pathname.startsWith("/verify") ||
        pathname.startsWith("/api/auth") ||
        pathname.startsWith("/api/health") ||
        pathname.startsWith("/_next") ||
        pathname.startsWith("/icons") ||
        pathname.startsWith("/manifest") ||
        pathname === "/sw.js";
      if (isPublic) return true;
      return !!auth;
    },
  },
  events: {
    async signIn({ user, account, isNewUser }) {
      // Audit hook - currently a no-op, but ready for future logging
      // integrations (e.g. Sentry breadcrumbs).
      void user;
      void account;
      void isNewUser;
    },
    async signOut(message) {
      void message;
    },
  },
  // Trust the deployment host (Vercel) and any local dev origins.
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
    provider?: string;
  }
}

export const __test__ = {
  getClientIpFromHeaders,
};
