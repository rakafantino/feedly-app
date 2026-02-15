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
          storeName: user.store?.name,
          storeRole: null // Default to null, will be populated by jwt callback
        };
      }
    })
  ],
  callbacks: {
    ...authConfig.callbacks,
    // Override jwt to add DB refresh logic (Node.js only)
    async jwt({ token, user, trigger, session }) {
       // Call base jwt logic first (mapping user to token)
       if (user) {
        token.id = user.id;
        token.role = (user.role as string).toLowerCase();
        token.storeId = user.storeId || null;
        token.storeName = user.storeName || null;
        token.storeRole = user.storeRole || null;
      }

      // Refresh from DB on each request to ensure fresh data
      if (token.id) {
        try {
          const freshUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: {
              storeId: true,
              role: true,
              accesses: {
                where: {
                  storeId: (token.storeId as string) || undefined
                },
                select: {
                  storeId: true,
                  role: true,
                  store: {
                    select: { name: true }
                  }
                },
                take: 1
              }
            }
          });
          
          if (freshUser) {
            token.storeId = freshUser.storeId;
            token.role = (freshUser.role as string).toLowerCase();
            
            // Get store-specific role from StoreAccess
            if (freshUser.accesses && freshUser.accesses.length > 0) {
              token.storeRole = freshUser.accesses[0].role.toLowerCase();
              token.storeName = freshUser.accesses[0].store.name || null;
            } else {
              token.storeRole = null;
            }
          }
        } catch (error) {
          console.error("Error refreshing session from DB:", error);
        }
      }

      // Handle explicit session update (e.g., store switch)
      if (trigger === 'update' && session) {
        token.storeId = session.storeId || token.storeId;
        token.storeRole = session.storeRole || token.storeRole;
        token.storeName = session.storeName || token.storeName;
      }
      
      return token;
    }
  },
  debug: process.env.NODE_ENV === 'development',
  secret: process.env.NEXTAUTH_SECRET || 'default-secret-key-change-this',
}); 