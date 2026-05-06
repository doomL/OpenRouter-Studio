import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";

/**
 * Minimal config for Edge middleware: JWT/session only, no Prisma.
 * Login runs via app/api/auth (lib/auth.ts); this instance only validates sessions.
 */
export const edgeAuthConfig = {
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/auth/login",
  },
  providers: [
    Credentials({
      id: "credentials",
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize() {
        return null;
      },
    }),
  ],
  callbacks: {
    authorized({ auth, request }) {
      if (!auth?.user) return false;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const trialEndsAt = (auth.user as any).trialEndsAt as string | null | undefined;
      if (trialEndsAt && new Date(trialEndsAt) < new Date()) {
        const { pathname } = new URL(request.url);
        if (!pathname.startsWith("/auth/")) {
          return Response.redirect(new URL("/auth/trial-expired", request.url));
        }
      }
      return true;
    },
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.name = user.name;
        token.email = user.email;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        token.trialEndsAt = (user as any).trialEndsAt ?? null;
      }
      if (trigger === "update" && session && typeof session === "object") {
        const s = session as { name?: string };
        if (typeof s.name === "string") {
          token.name = s.name.trim() || token.name;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token?.id) {
        session.user.id = token.id as string;
      }
      if (typeof token.name === "string") {
        session.user.name = token.name;
      }
      if (typeof token.email === "string") {
        session.user.email = token.email;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (session.user as any).trialEndsAt = token.trialEndsAt ?? null;
      return session;
    },
  },
} satisfies NextAuthConfig;
