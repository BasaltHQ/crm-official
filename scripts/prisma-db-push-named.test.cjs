const assert = require("node:assert/strict");
const { test } = require("node:test");
const { prepareDatabaseUrl, targetDatabase } = require("./prisma-db-push-named.cjs");

test("OVH uses SHA-256 without replacing an existing database or its implicit auth source", () => {
  const input = "mongodb+srv://user:pass@mongo-example.database.cloud.ovh.net/crm?tls=true&retryWrites=false";
  assert.equal(prepareDatabaseUrl(input, "BasaltCRM"), `${input}&authMechanism=SCRAM-SHA-256`);
  assert.equal(targetDatabase(prepareDatabaseUrl(input, "BasaltCRM")), "crm");
});

test("OVH US connection keeps crm, replica set, TLS, and explicit admin authentication", () => {
  const input = "mongodb+srv://user:p%40ss@mongodb-example-a1b2c3.database.cloud.ovh.us/crm?replicaSet=replicaset&tls=true&authSource=admin";
  assert.equal(prepareDatabaseUrl(input, "BasaltCRM"), `${input}&authMechanism=SCRAM-SHA-256`);
  assert.equal(targetDatabase(prepareDatabaseUrl(input, "BasaltCRM")), "crm");
});

test("adding a named database leaves unspecified authentication sources untouched", () => {
  for (const path of ["", "/"]) {
    const input = `mongodb://user:pass@mongo-example.database.cloud.ovh.net${path}?tls=true`;
    assert.equal(
      prepareDatabaseUrl(input),
      "mongodb://user:pass@mongo-example.database.cloud.ovh.net/BasaltCRM?tls=true&authMechanism=SCRAM-SHA-256",
    );
  }
});

test("adding a database to SRV URIs does not override an authentication source supplied by DNS TXT", () => {
  for (const host of ["cluster.mongodb.net", "mongo-example.database.cloud.ovh.net", "mongo-example.database.cloud.ovh.us"]) {
    const input = `mongodb+srv://user:pass@${host}/?tls=true`;
    const output = prepareDatabaseUrl(input, "crm");
    assert.equal(new URL(output).pathname, "/crm");
    assert.equal(new URL(output).searchParams.has("authSource"), false);
  }
});

test("explicit auth options and credential/query encoding are preserved byte for byte", () => {
  for (const mechanism of ["SCRAM-SHA-1", "SCRAM-SHA-256", "MONGODB-X509"]) {
    const input = `mongodb+srv://user%40example:p%3Ass%2Fword@mongo-example.database.cloud.ovh.net/crm?AUTHsource=custom%2Dauth&AUTHmechanism=${mechanism}&appName=CRM%20Sandbox&readPreferenceTags=dc:one&readPreferenceTags=dc:two`;
    assert.equal(prepareDatabaseUrl(input), input);
  }
});

test("an explicit auth source is not changed when the database path is missing", () => {
  const input = "mongodb+srv://user:pass@mongo-example.database.cloud.ovh.net/?authSource=users&authMechanism=SCRAM-SHA-256";
  assert.equal(prepareDatabaseUrl(input, "crm"), input.replace("/?", "/crm?"));
});

test("multi-host MongoDB URIs retain their replica set and credentials", () => {
  const input = "mongodb://user:p%40ss@one.database.cloud.ovh.net:27017,two.database.cloud.ovh.net:27018/?replicaSet=rs0&tls=true";
  assert.equal(
    prepareDatabaseUrl(input, "crm"),
    input.replace("/?", "/crm?") + "&authMechanism=SCRAM-SHA-256",
  );
});

test("unrelated MongoDB hosts keep their negotiated authentication mechanism", () => {
  for (const host of ["cluster.mongodb.net", "localhost:27017", "database.cloud.ovh.net.attacker.example", "mongo-example.database.cloud.ovh.net.attacker.example", "mongo-example.database.cloud.ovh.us.attacker.example", "mongo-example.database.cloud.ovh.us-other", "[::1]:27017"]) {
    const input = `mongodb://user:pass@${host}/crm?tls=true`;
    assert.equal(prepareDatabaseUrl(input), input);
  }
  const input = "mongodb://user:pass@localhost:27017";
  assert.equal(prepareDatabaseUrl(input, "crm"), `${input}/crm`);
});

test("connections without credentials do not acquire authentication options", () => {
  assert.equal(prepareDatabaseUrl("mongodb://localhost:27017"), "mongodb://localhost:27017/BasaltCRM");
  assert.equal(prepareDatabaseUrl("mongodb+srv://mongo-example.database.cloud.ovh.net/"), "mongodb+srv://mongo-example.database.cloud.ovh.net/BasaltCRM");
});

test("external authentication is not redirected to admin", () => {
  for (const mechanism of ["MONGODB-X509", "MONGODB-AWS", "GSSAPI", "PLAIN", "MONGODB-OIDC"]) {
    const input = `mongodb://user@localhost/?authMechanism=${mechanism}`;
    assert.equal(prepareDatabaseUrl(input, "crm"), input.replace("/?", "/crm?"));
  }
});

test("database names are encoded once and reported from the selected URI path", () => {
  const input = "mongodb://localhost";
  assert.equal(prepareDatabaseUrl(input, "CRM+Sandbox"), "mongodb://localhost/CRM%2BSandbox");
  assert.equal(targetDatabase(prepareDatabaseUrl(input, "CRM+Sandbox")), "CRM+Sandbox");
  assert.equal(targetDatabase(prepareDatabaseUrl("mongodb://localhost/existing", "ignored")), "existing");
});

test("empty or trailing query separators do not produce duplicate delimiters", () => {
  for (const query of ["?", "?tls=true&"]) {
    const input = `mongodb://user:pass@mongo-example.database.cloud.ovh.net/crm${query}`;
    assert.equal(prepareDatabaseUrl(input), `${input}authMechanism=SCRAM-SHA-256`);
  }
});

test("invalid URIs fail without exposing their contents", () => {
  for (const input of ["not-a-uri-with-secret", "https://user:secret@example.com", "mongodb://user:secret@host/db#fragment"]) {
    assert.throws(() => prepareDatabaseUrl(input), { message: "DATABASE_URL must be a MongoDB connection URI." });
  }
});

test("importing the helper does not load env files or child processes", () => {
  const Module = require("node:module");
  const modulePath = require.resolve("./prisma-db-push-named.cjs");
  const originalLoad = Module._load;
  delete require.cache[modulePath];
  Module._load = function (request, ...args) {
    assert.ok(!["dotenv", "child_process", "fs"].includes(request), `unexpected import: ${request}`);
    return originalLoad.call(this, request, ...args);
  };
  try {
    assert.equal(typeof require(modulePath).prepareDatabaseUrl, "function");
  } finally {
    Module._load = originalLoad;
  }
});
