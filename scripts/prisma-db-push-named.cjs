#!/usr/bin/env node
/* 
Prisma Mongo: ensure a database name is present for db push without changing .env

- Reads DATABASE_URL from env
- If no path database is present (e.g. mongodb+srv://user:pass@host), appends "/{PRISMA_DB_NAME}" (default: "BasaltCRM")
- Preserves explicit database and authentication options, including query encoding
- Leaves authSource untouched, including any value supplied by SRV DNS records
- Uses SCRAM-SHA-256 for OVH Cloud MongoDB when no mechanism is explicitly set
- Spawns "npx prisma db push" with the adjusted DATABASE_URL for this process only
- Keeps your .env untouched to avoid impacting auth or other services reading a different default DB

Configure via env (optional):
  PRISMA_DB_NAME        -> database name to append (default: BasaltCRM)
*/

function parseMongoUrl(raw) {
  // A MongoDB authority can contain multiple hosts; WHATWG URL rejects those.
  // Keep its bytes intact so encoded credentials and driver options are unchanged.
  const match = /^(mongodb(?:\+srv)?:\/\/)([^/?#]+)(\/[^?#]*)?(\?[^#]*)?$/i.exec(raw);
  if (!match) {
    throw new Error("DATABASE_URL must be a MongoDB connection URI.");
  }
  const [, scheme, authority, pathname = "", query = ""] = match;
  return { scheme, authority, pathname, query };
}

function prepareDatabaseUrl(raw, dbName = "BasaltCRM") {
  let { scheme, authority, pathname, query } = parseMongoUrl(raw);
  const options = new URLSearchParams(query);
  const optionKeys = new Set([...options.keys()].map((key) => key.toLowerCase()));
  const hasCredentials = authority.lastIndexOf("@") > 0;
  const hosts = authority.slice(authority.lastIndexOf("@") + 1).split(",");
  const isOvh = hosts.every((host) => /^[^:]+\.database\.cloud\.ovh\.(?:net|us)\.?(:\d+)?$/i.test(host));
  const appendOption = (key, value) => {
    const separator = query ? (/[?&]$/.test(query) ? "" : "&") : "?";
    query += `${separator}${key}=${encodeURIComponent(value)}`;
  };

  if (!pathname || pathname === "/") {
    pathname = `/${encodeURIComponent(dbName)}`;
  }
  if (isOvh && hasCredentials && !optionKeys.has("authmechanism")) {
    appendOption("authMechanism", "SCRAM-SHA-256");
  }
  return `${scheme}${authority}${pathname}${query}`;
}

function targetDatabase(raw) {
  const { pathname } = parseMongoUrl(raw);
  return decodeURIComponent(pathname.slice(1));
}

function main() {
  const { spawnSync } = require("child_process");
  const fs = require("fs");
  const path = require("path");
  const dotenv = require("dotenv");

  // Existing process variables win; the first env file containing a key wins.
  const envFiles = [".env.production.local", ".env.local", ".env.production", ".env"];
  for (const file of envFiles) {
    const envPath = path.resolve(process.cwd(), file);
    if (fs.existsSync(envPath)) dotenv.config({ path: envPath });
  }

  const base = process.env.DATABASE_URL;
  if (!base) {
    console.error("[prisma-db-push-named] DATABASE_URL is not set in env.");
    process.exit(1);
  }

  const dbName = process.env.PRISMA_DB_NAME || "BasaltCRM";
  let adjusted;
  try {
    adjusted = prepareDatabaseUrl(base, dbName);
    // Do not log the URI: query options can contain credentials too.
    console.log(`[prisma-db-push-named] Target database name: ${targetDatabase(adjusted)}`);
  } catch (_error) {
    console.error("[prisma-db-push-named] DATABASE_URL is not a valid MongoDB connection URI.");
    process.exit(1);
  }


  const cmd = process.platform === "win32" ? "npx.cmd" : "npx";
  const result = spawnSync(
    `${cmd} prisma db push`,
    {
      stdio: "inherit",
      env: { ...process.env, DATABASE_URL: adjusted },
      shell: true,
    }
  );

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

module.exports = { prepareDatabaseUrl, targetDatabase };

// Importing the URI helpers never reads env files or starts Prisma.
if (require.main === module) main();
