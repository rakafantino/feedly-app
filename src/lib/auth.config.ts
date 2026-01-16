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
      
      // Jika URL sudah absolute dan dimulai dengan baseUrl, gunakan URL tersebut
      if (url.startsWith(baseUrl)) {
        return url;
      }
      
      // Jika ada callbackUrl, gunakan itu untuk redirect
      if (url.startsWith('/') || url.startsWith(baseUrl)) {
        try {
          // Coba ekstrak callbackUrl jika ada
          const urlObj = new URL(url, baseUrl);
          const callbackUrl = urlObj.searchParams.get("callbackUrl");
          
          if (callbackUrl) {
            // Verifikasi bahwa callbackUrl adalah internal URL
            if (callbackUrl.startsWith('/')) {
              return `${baseUrl}${callbackUrl}`;
            }
          }
        } catch (e) {
          console.error("Error parsing URL:", e);
        }
      }
      
      // Default: kembalikan ke dashboard setelah login
      return `${baseUrl}/dashboard`;
    }
  },
  providers: [] // Empty providers for middleware
} satisfies NextAuthConfig;
