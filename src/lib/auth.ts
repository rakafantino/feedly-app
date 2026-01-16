import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcryptjs from 'bcryptjs';
import prisma from '@/lib/prisma';
import { authConfig } from '@/lib/auth.config';

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
  ...authConfig,
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const { email, password } = credentials as Credentials;

        const user = await prisma.user.findUnique({
          where: { email },
          include: { store: true }
        });

        if (!user) {
          return null;
        }

        const isPasswordValid = await bcryptjs.compare(
          password,
          user.password || ''
        );

        if (!isPasswordValid) {
          return null;
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          storeId: user.storeId,
          storeName: user.store?.name
        };
      }
    })
  ],
  callbacks: {
    ...authConfig.callbacks,
    // Override jwt to add DB refresh logic (Node.js only)
    async jwt({ token, user }) {
       // Call base jwt logic first (mapping user to token)
       if (user) {
        token.id = user.id;
        token.role = (user.role as string).toLowerCase();
        token.storeId = user.storeId || null;
        token.storeName = user.storeName || null;
      }

      // Force refresh data from DB to ensure store switching works immediately
      if (token.id) {
         try {
            const freshUser = await prisma.user.findUnique({ 
                where: { id: token.id as string },
                select: { 
                storeId: true, 
                role: true, 
                store: { 
                    select: { name: true } 
                } 
                }
            });
            
            if (freshUser) {
                token.storeId = freshUser.storeId;
                token.role = (freshUser.role as string).toLowerCase();
                token.storeName = freshUser.store?.name || null;
            }
         } catch (error) {
            console.error("Error refreshing session from DB:", error);
         }
      }
      
      return token;
    }
  },
  debug: process.env.NODE_ENV === 'development',
  secret: process.env.NEXTAUTH_SECRET || 'default-secret-key-change-this',
}); 