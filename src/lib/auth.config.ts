import type { NextAuthConfig } from 'next-auth';

/**
 * Extended session type with store context
 */
export interface SessionWithStore {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    role: string;
    storeId: string | null;
    storeName: string | null;
    storeRole: string | null; // NEW: Role specific to the store (from StoreAccess)
  };
}

/**
 * Auth configuration with RLS support
 */
export const authConfig = {
  pages: {
    signIn: '/login',
    error: '/login',
    signOut: '/login'
  },
  session: {
    strategy: "jwt" as const,
    maxAge: 24 * 60 * 60, // 1 day
  },
  callbacks: {
    /**
     * JWT callback - Add store context to token
     */
    async jwt({ token, user, trigger, session }) {
      // Initial login - set user data
      if (user) {
        token.id = user.id;
        token.role = (user.role as string).toLowerCase();
        token.storeId = user.storeId || null;
        token.storeName = user.storeName || null;
        token.storeRole = user.storeRole || null;
      }

      // Handle explicit session update (e.g., store switch)
      if (trigger === 'update' && session) {
        token.storeId = session.storeId || token.storeId;
        token.storeRole = session.storeRole || token.storeRole;
        token.storeName = session.storeName || token.storeName;
      }

      return token;
    },

    /**
     * Session callback - Expose store context to client
     */
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.storeId = token.storeId as string || null;
        session.user.storeName = token.storeName as string || null;
        session.user.storeRole = token.storeRole as string || null; // NEW
      }
      return session;
    },

    async redirect({ url, baseUrl }) {
      if (url.startsWith('/')) {
        return `${baseUrl}${url}`;
      }
      if (url.startsWith(baseUrl)) {
        return url;
      }
      return `${baseUrl}/dashboard`;
    }
  },
  providers: [] // Empty providers for middleware
} satisfies NextAuthConfig;
