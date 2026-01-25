import type { NextAuthConfig } from 'next-auth';

export const authConfig = {
  pages: {
    signIn: '/login',
    error: '/login',
    signOut: '/login'
  },
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 1 hari
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user.role as string).toLowerCase();
        token.storeId = user.storeId || null;
        token.storeName = user.storeName || null;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.storeId = token.storeId as string || null;
        session.user.storeName = token.storeName as string || null;
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      // Log params untuk debug
      console.log("Redirect:", { url, baseUrl });
      
      // Jika URL adalah path relatif, gabungkan dengan baseUrl (yang sekarang akan mengikuti host header karena AUTH_TRUST_HOST)
      if (url.startsWith('/')) {
        return `${baseUrl}${url}`;
      }
      
      // Jika URL sudah absolute dan dimulai dengan baseUrl, gunakan URL tersebut
      if (url.startsWith(baseUrl)) {
        return url;
      }
      
      // Default: kembalikan ke dashboard setelah login
      return `${baseUrl}/dashboard`;
    }
  },
  providers: [] // Empty providers for middleware
} satisfies NextAuthConfig;
