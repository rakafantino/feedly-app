import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcryptjs from "bcryptjs";
import prisma from "@/lib/db";
import { authConfig } from "@/lib/auth.config";

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
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const { email, password } = credentials as Credentials;

        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user) {
          return null;
        }

        const isPasswordValid = await bcryptjs.compare(password, user.password || "");

        if (!isPasswordValid) {
          return null;
        }

        let storeName = null;
        if (user.storeId) {
          try {
            // Kita masih gunakan transaksi di sini untuk login awal (jarang dipanggil)
            // agar bisa mengambil nama toko dengan konteks yang benar jika diperlukan
            await prisma.$transaction(async (tx) => {
              await tx.$executeRaw`SELECT set_tenant_context(${user.storeId}::text, ${user.id}::text)`;
              const store = await tx.store.findUnique({ where: { id: user.storeId! } });
              storeName = store?.name;
            });
          } catch (error) {
            console.error("Error fetching store details in authorize:", error);
          }
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          storeId: user.storeId,
          storeName: storeName,
          storeRole: null, // Default to null, will be populated by jwt callback
        };
      },
    }),
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

      // Token data is set on login and refreshed on explicit store-switch.
      // No per-request DB refresh — this was causing a DB hit on every auth() call.

      // Handle explicit session update (e.g., store switch)
      if (trigger === "update" && session) {
        token.storeId = session.storeId || token.storeId;
        token.storeRole = session.storeRole || token.storeRole;
        token.storeName = session.storeName || token.storeName;
      }

      return token;
    },
  },
  // debug: process.env.NODE_ENV === "development", // Disable debug logs to reduce console noise
  secret: process.env.NEXTAUTH_SECRET || "default-secret-key-change-this",
});
