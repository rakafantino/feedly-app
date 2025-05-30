import { DefaultSession, DefaultUser } from "next-auth";

declare module "next-auth" {
  /**
   * Menambahkan type untuk role user dan id
   */
  interface Session {
    user: {
      id: string;
      role: string;
      storeId: string | null;
      storeName: string | null;
    } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    role: string;
    storeId?: string | null;
    storeName?: string | null;
  }
}

declare module "next-auth/jwt" {
  /** 
   * Menambahkan type untuk token 
   */
  interface JWT {
    id: string;
    role: string;
    storeId: string | null;
    storeName: string | null;
  }
} 