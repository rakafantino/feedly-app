import { DefaultSession } from "next-auth"

declare module "next-auth" {
  /**
   * Returned by `useSession`, `getSession` and received as a prop on the `SessionProvider` React Context
   */
  interface Session {
    user: {
      id: string;
      role: string;
      storeId: string | null;
      storeName: string | null;
      storeRole: string | null;
    } & DefaultSession["user"]
  }

  interface User {
    id: string;
    role: string;
    storeId: string | null;
    storeName: string | null;
    storeRole: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    storeId: string | null;
    storeName: string | null;
    storeRole: string | null;
  }
}
