import { prismadb } from "@/lib/prisma";
import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import GitHubProvider from "next-auth/providers/github";
import AzureADProvider from "next-auth/providers/azure-ad";
import CredentialsProvider from "next-auth/providers/credentials";
import { comparePassword } from "@/lib/password-utils";
import { logActivityInternal } from "@/actions/audit";

function getGoogleCredentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.GOOGLE_ID;
  const clientSecret = process.env.GOOGLE_SECRET;
  if (!clientId || clientId.length === 0 || !clientSecret || clientSecret.length === 0) {
    return { clientId: "", clientSecret: "" };
  }
  return { clientId, clientSecret };
}

export const authOptions: NextAuthOptions = {
  secret: process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // SOC2: 8-hour session cap
    updateAge: 60 * 60, // Refresh token every hour
  },

  providers: [
    GoogleProvider({
      clientId: getGoogleCredentials().clientId,
      clientSecret: getGoogleCredentials().clientSecret,
    }),

    GitHubProvider({
      name: "github",
      clientId: process.env.GITHUB_ID || "",
      clientSecret: process.env.GITHUB_SECRET || "",
    }),

    AzureADProvider({
      clientId: process.env.AZURE_CLIENT_ID || "",
      clientSecret: process.env.AZURE_CLIENT_SECRET || "",
      tenantId: process.env.AZURE_TENANT_ID || "common",
    }),

    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "email", type: "text" },
        password: { label: "password", type: "password" },
        mfaCode: { label: "mfaCode", type: "text" },
        mfaToken: { label: "mfaToken", type: "text" },
      },

      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Invalid email or password");
        }

        const normalizedEmail =
          typeof credentials.email === "string"
            ? credentials.email.trim().toLowerCase()
            : credentials.email;

        const trimmedPassword = credentials.password.trim();
        if (trimmedPassword.length > 256) {
          throw new Error("Invalid email or password");
        }

        const user = await prismadb.users.findFirst({
          where: {
            email: { equals: normalizedEmail, mode: "insensitive" },
          },
        });

        if (!user || !user.password) {
          // Constant-work dummy check to mitigate timing enumeration
          await comparePassword(
            trimmedPassword,
            "$2a$12$CwTycUXWue0Thq9StjUM0uJ8p3bK5eG1N0W5xH0e3G8S9tL4mZ8qG"
          );
          throw new Error("Invalid email or password");
        }

        const isCorrectPassword = await comparePassword(
          trimmedPassword,
          user.password
        );

        if (!isCorrectPassword) {
          throw new Error("Invalid email or password");
        }

        if (user.userStatus !== "ACTIVE") {
          throw new Error("Your account is pending approval or inactive. Please contact support.");
        }

        // SOC2/NIST MFA Check
        const userAny = user as any;
        if (userAny.mfaEnabled) {
          const mfaCode = (credentials as any).mfaCode;
          const mfaToken = (credentials as any).mfaToken;

          if (mfaCode && userAny.mfaSecret) {
            const { verifyTotpToken } = await import("./mfa-utils");
            const isValid = await verifyTotpToken(mfaCode, userAny.mfaSecret || "");
            if (!isValid) throw new Error("Invalid verification code");
          } else if (mfaToken) {
            const { jwtVerify } = await import("jose");
            try {
              const jwtSec = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET;
              if (!jwtSec) throw new Error("Server misconfigured");
              const secret = new TextEncoder().encode(jwtSec);
              const { payload } = await jwtVerify(mfaToken, secret);
              if (payload.sub !== user.id || !payload.mfaVerified) {
                throw new Error("Invalid MFA token");
              }
            } catch {
              throw new Error("MFA verification expired. Please try again.");
            }
          } else {
            const authenticatorCount = await prismadb.authenticator.count({ where: { userId: user.id } });
            const availableMethods: string[] = [];
            if (userAny.mfaSecret) availableMethods.push("TOTP");
            if (authenticatorCount > 0) availableMethods.push("WEBAUTHN");
            const primaryMethod = availableMethods.includes("TOTP")
              ? "TOTP"
              : availableMethods[0] || userAny.mfaMethod;
            throw new Error(`MFA_REQUIRED:${primaryMethod}:${availableMethods.join(",")}`);
          }
        }

        await logActivityInternal(
          userAny.id,
          "LOGIN_SUCCESS",
          "auth",
          userAny.mfaEnabled ? "Step 1+MFA: Credentials" : "Full login",
          userAny.team_id
        );

        return user;
      },
    }),
  ],
  events: {
    async signIn({ user }: any) {
      if (!user?.id) return;
      try {
        await prismadb.users.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });
        await logActivityInternal(user.id, "LOGIN_SUCCESS", "Auth", "User logged in successfully", user.team_id);
      } catch (_err) {
        console.error("Error in signIn event:", _err);
      }
    },
  },
  callbacks: {
    async signIn({ user, account, profile }: any) {
      if (!account || account.provider === "credentials") {
        return true;
      }

      const rawEmail = user?.email || profile?.email;
      if (!rawEmail || typeof rawEmail !== "string") {
        return false;
      }
      const normalizedEmail = rawEmail.trim().toLowerCase();

      // Verify OAuth provider email ownership claims (mitigates Azure AD 'common' nOAuth takeover)
      if (account.provider === "google" && profile?.email_verified !== true) {
        return false;
      }
      if (account.provider === "azure-ad") {
        // Require verified domain/email claim for multi-tenant Azure AD
        if (profile?.email_verified === false || profile?.xms_edov === false) {
          return false;
        }
        const configuredTenant = process.env.AZURE_TENANT_ID || "common";
        if (
          (configuredTenant === "common" || configuredTenant === "organizations" || configuredTenant === "consumers") &&
          profile?.xms_edov !== true &&
          profile?.email_verified !== true
        ) {
          return false;
        }
      }

      const existingUser = await prismadb.users.findFirst({
        where: { email: { equals: normalizedEmail, mode: "insensitive" } },
        select: { id: true, userStatus: true, mfaEnabled: true },
      });

      if (existingUser) {
        if (existingUser.userStatus === "INACTIVE") {
          return false;
        }
        // Prevent bypassing MFA via implicit OAuth account linking
        if (existingUser.mfaEnabled) {
          return false;
        }
      }

      return true;
    },

    async jwt({ token, user }: any) {
      if (user) {
        const email = typeof (user.email || token.email) === "string"
          ? (user.email || token.email).trim().toLowerCase()
          : undefined;
        token.email = email || token.email;

        if ((user as any).session_version !== undefined && user.id && /^[0-9a-fA-F]{24}$/.test(String(user.id))) {
          token.id = user.id;
          token.session_version = (user as any).session_version ?? 1;
        } else if (email) {
          // OAuth sign-in: resolve canonical DB user (or provision if missing) so session_version is always bound
          let dbUser = await prismadb.users.findFirst({
            where: { email: { equals: email, mode: "insensitive" } },
            select: { id: true, session_version: true },
          });
          if (!dbUser) {
            dbUser = await prismadb.users.create({
              data: {
                email,
                name: user.name || token.name || null,
                avatar: user.image || token.picture || null,
                is_admin: false,
                is_account_admin: false,
                lastLoginAt: new Date(),
                userStatus: process.env.ALLOW_OPEN_REGISTRATION === "true" ? "ACTIVE" : "PENDING",
              },
              select: { id: true, session_version: true },
            });
          }
          token.id = dbUser.id;
          token.session_version = dbUser.session_version ?? 1;
        }
      }
      return token;
    },

    async session({ token, session }: any) {
      if (!token?.email) {
        delete session.user;
        return session;
      }

      const tokenEmail =
        typeof token.email === "string" ? token.email.trim().toLowerCase() : token.email;

      const user = await prismadb.users.findFirst({
        where: {
          email: { equals: tokenEmail, mode: "insensitive" },
        },
        include: {
          assigned_team: {
            include: {
              assigned_plan: true,
            },
          },
        },
      });

      if (!user) {
        session.error = "SessionInvalidated";
        delete session.user;
        return session;
      }

      // SOC2 CC6.1: Strictly enforce session_version revocation across ALL auth providers
      const dbVersion = user.session_version ?? 1;
      const tokenVersion = token.session_version ?? 1;
      if (dbVersion !== tokenVersion) {
        session.error = "SessionInvalidated";
        delete session.user;
        return session;
      }

      session.user.id = user.id;
      session.user._id = user.id;
      session.user.name = user.name;
      session.user.email = user.email;
      session.user.avatar = user.avatar;
      session.user.image = user.avatar;
      session.user.isAdmin = Boolean(user.is_admin);
      session.user.is_account_admin = Boolean(user.is_account_admin);
      session.user.userLanguage = user.userLanguage;
      session.user.userStatus = user.userStatus;
      session.user.lastLoginAt = user.lastLoginAt;
      session.user.team_id = user.team_id;
      session.user.team_role = user.team_role;
      session.user.mustChangePassword = Boolean(user.mustChangePassword);
      session.user.termsAccepted = typeof (user as any).termsAccepted === "boolean" ? (user as any).termsAccepted : false;
      session.user.assigned_team = user.assigned_team;

      if (user.roleId) {
        const role = await prismadb.role.findUnique({
          where: { id: user.roleId },
        });
        if (role) {
          session.user.role = role.name;
          session.user.permissions = role.permissions;
        }
      }

      return session;
    },
  },
};

let cachedOptions: NextAuthOptions | null = null;
let lastCacheTime = 0;
const CACHE_TTL = 60 * 1000;

export async function getDynamicAuthOptions(): Promise<NextAuthOptions> {
  const now = Date.now();
  if (cachedOptions && (now - lastCacheTime < CACHE_TTL)) {
    return cachedOptions;
  }

  const newOptions = { ...authOptions, providers: [...authOptions.providers] };

  try {
    const dbConfigs = await prismadb.systemAuthConfig.findMany({
      where: { enabled: true }
    });

    for (const config of dbConfigs) {
      if (config.provider === "google") {
        const existingIndex = newOptions.providers.findIndex(p => p.id === "google");
        const provider = GoogleProvider({
          clientId: config.clientId,
          clientSecret: config.clientSecret
        });
        if (existingIndex >= 0) newOptions.providers[existingIndex] = provider;
        else newOptions.providers.push(provider);
      } else if (config.provider === "github") {
        const existingIndex = newOptions.providers.findIndex(p => p.id === "github");
        const provider = GitHubProvider({
          name: "github",
          clientId: config.clientId,
          clientSecret: config.clientSecret
        });
        if (existingIndex >= 0) newOptions.providers[existingIndex] = provider;
        else newOptions.providers.push(provider);
      } else if (config.provider === "azure-ad") {
        const existingIndex = newOptions.providers.findIndex(p => p.id === "azure-ad");
        const provider = AzureADProvider({
          clientId: config.clientId,
          clientSecret: config.clientSecret,
          tenantId: config.tenantId || "common",
        });
        if (existingIndex >= 0) newOptions.providers[existingIndex] = provider;
        else newOptions.providers.push(provider);
      }
    }
  } catch (error) {
    console.error("Failed to fetch dynamic auth config:", error);
  }

  cachedOptions = newOptions;
  lastCacheTime = now;
  return newOptions;
}
