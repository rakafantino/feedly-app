import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';

/**
 * Tipe untuk credentials
 */
interface Credentials {
  email: string;
  password: string;
}

/**
 * Konfigurasi autentikasi menggunakan NextAuth
 * Menggunakan Credentials Provider untuk login dengan email/password
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          console.log("Credentials missing");
          return null;
        }

        // Cast credentials ke type yang diharapkan
        const { email, password } = credentials as Credentials;

        // Cari user di database
        const user = await prisma.user.findUnique({
          where: { email }
        });

        // Jika user tidak ditemukan
        if (!user) {
          console.log("User not found");
          return null;
        }

        // Periksa password
        const isPasswordValid = await bcrypt.compare(
          password,
          user.password || ''
        );

        if (!isPasswordValid) {
          console.log("Invalid password");
          return null;
        }

        // Kembalikan data user (tanpa password)
        console.log("Login successful", user.email);
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role
        };
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user.role as string).toLowerCase();
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
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
  pages: {
    signIn: '/login',
    error: '/login',
    signOut: '/login'
  },
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 1 hari
  },
  debug: process.env.NODE_ENV === 'development',
  secret: process.env.NEXTAUTH_SECRET || 'default-secret-key-change-this',
});

// Tambahkan definisi tipe untuk NextAuth.js
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      role: string;
    }
  }
} 