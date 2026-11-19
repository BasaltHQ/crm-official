import crypto from "crypto";
import { createAuth } from "thirdweb/auth";
import { privateKeyToAccount } from "thirdweb/wallets";
import { client } from "./thirdweb";
import { sha256 } from "thirdweb/utils";

export const isThirdwebConfigured = Boolean(
  process.env.THIRDWEB_SECRET_KEY && process.env.THIRDWEB_SECRET_KEY.trim().length > 0
);

// Never fall back to a static predictable private key; generate a per-process CSPRNG key
// so build-time module imports succeed while unconfigured runtime endpoints fail closed.
const ephemeralFallbackHex = `0x${crypto.randomBytes(32).toString("hex")}` as `0x${string}`;

const secretHex = (
  isThirdwebConfigured
    ? sha256(process.env.THIRDWEB_SECRET_KEY as `0x${string}`)
    : ephemeralFallbackHex
) as `0x${string}`;

const adminAccount = privateKeyToAccount({
  client,
  privateKey: secretHex,
});

const domain =
  process.env.NEXT_PUBLIC_THIRDWEB_AUTH_DOMAIN || "localhost:3000";

export const thirdwebAuth = createAuth({
  domain,
  adminAccount,
  client,
  login: {
    statement: "Sign in to BasaltCRM",
    uri: typeof window !== "undefined" ? window.location.origin : `https://${domain}`,
    resources: [`https://${domain}`],
    version: "1",
  },
});
