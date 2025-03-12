import type { NextAuthConfig } from 'next-auth';

export const authConfig = {
  pages: {
    signIn: '/login',
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnDashboard = nextUrl.pathname.startsWith('/dashboard');
      const isOnPOS = nextUrl.pathname.startsWith('/pos');
      const isOnLogin = nextUrl.pathname === '/login';
      
      // Jika user mencoba mengakses halaman yang terproteksi tanpa login
      if ((isOnDashboard || isOnPOS) && !isLoggedIn) {
        return false; // Redirect ke halaman login
      }
      
      // Jika user sudah login tetapi mengakses halaman login
      if (isOnLogin && isLoggedIn) {
        return Response.redirect(new URL('/dashboard', nextUrl));
      }
      
      return true;
    },
  },
  providers: [],
} satisfies NextAuthConfig; 