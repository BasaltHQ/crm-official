import type { Session, User } from "next-auth";
import type { JWT } from "next-auth/jwt";

type UserId = string;

declare module "next-auth/jwt" {
  interface JWT {
    id: UserId;
    session_version?: number;
  }
}

declare module "next-auth" {
  interface Session {
    error?: string;
    user: User & {
      id: UserId;
      _id: UserId;
      avatar?: string | null | undefined;
      isAdmin: boolean;
      is_account_admin?: boolean;
      userLanguage: string;
      userStatus: string;
      role?: string;
      permissions?: string[];
      team_id?: string | null;
      team_role?: string | null;
      mustChangePassword: boolean;
      termsAccepted?: boolean;
    };
  }
}
