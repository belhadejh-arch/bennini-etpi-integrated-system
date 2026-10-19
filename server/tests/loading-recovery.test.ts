import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fetchWithRecovery, NetworkRequestError } from "../../lib/http-recovery";
import { shouldClearSavedSession } from "../../lib/session-policy";
import { retryDatabaseRead } from "../read-recovery";
import { memberLookupQuery, memberReadinessQuery } from "../member-queries";
import pg from "pg";

const noWait = async () => undefined;
const fetcher = (fn: () => Promise<Response>) => fn as typeof fetch;

test("transient data-loading failures recover automatically with bounded retries", async () => {
  let calls = 0;
  const response = await fetchWithRecovery("/api/transactions", {}, {
    fetcher: fetcher(async () => {
      calls += 1;
      if (calls === 1) throw new TypeError("offline");
      return new Response("{}", { status: calls === 2 ? 503 : 200 });
    }), sleep: noWait,
  });
  assert.equal(calls, 3);
  assert.equal(response.status, 200);
});

test("deterministic authorization failures are not retried", async () => {
  for (const status of [400, 401, 403, 404]) {
    let calls = 0;
    const response = await fetchWithRecovery("/api/transactions", {}, {
      fetcher: fetcher(async () => { calls += 1; return new Response("{}", { status }); }), sleep: noWait,
    });
    assert.equal(response.status, status);
    assert.equal(calls, 1);
  }
});

test("financial writes are never replayed after a network failure or server error", async () => {
  for (const method of ["POST", "PATCH", "DELETE"]) {
    let calls = 0;
    await assert.rejects(fetchWithRecovery("/api/transactions", { method }, {
      fetcher: fetcher(async () => { calls += 1; throw new TypeError("response lost after commit"); }), sleep: noWait,
    }), (error: unknown) => error instanceof NetworkRequestError && error.isWrite);
    assert.equal(calls, 1);
    calls = 0;
    const response = await fetchWithRecovery("/api/transactions", { method }, {
      fetcher: fetcher(async () => { calls += 1; return new Response("{}", { status: 503 }); }), sleep: noWait,
    });
    assert.equal(response.status, 503);
    assert.equal(calls, 1);
  }
});

test("offline retries stop after three attempts and preserve a saved session", async () => {
  let calls = 0;
  await assert.rejects(fetchWithRecovery("/api/me", {}, {
    fetcher: fetcher(async () => { calls += 1; throw new TypeError("offline"); }), sleep: noWait,
  }), NetworkRequestError);
  assert.equal(calls, 3);
  for (const issue of [new TypeError("offline"), { status: 500 }, { status: 503 }, { status: 504 }]) {
    assert.equal(shouldClearSavedSession(issue), false);
  }
  assert.equal(shouldClearSavedSession({ status: 401 }), true);
  assert.equal(shouldClearSavedSession({ status: 403 }), true);
});

test("timeouts are bounded and explicit caller cancellation is respected", async () => {
  let calls = 0;
  await assert.rejects(fetchWithRecovery("/api/me", {}, {
    fetcher: (async (_url, options) => {
      calls += 1;
      return new Promise((_resolve, reject) => options?.signal?.addEventListener("abort", () => reject(new Error("timeout"))));
    }) as typeof fetch, sleep: noWait, timeoutMs: 5,
  }), (error: unknown) => error instanceof NetworkRequestError && error.timedOut);
  assert.equal(calls, 3);
  const controller = new AbortController();
  controller.abort(new Error("caller cancelled"));
  await assert.rejects(fetchWithRecovery("/api/me", { signal: controller.signal }, {
    fetcher: fetcher(async () => { throw new Error("must not run"); }), sleep: noWait,
  }), /caller cancelled/);
});

test("the shared member lookup recovers a broken database connection but never hides SQL errors", async () => {
  let calls = 0;
  const result = await retryDatabaseRead(async () => {
    calls += 1;
    if (calls === 1) throw Object.assign(new Error("connection reset"), { code: "ECONNRESET" });
    return { id: "fixture-member" };
  }, noWait);
  assert.equal(calls, 2);
  assert.equal(result.id, "fixture-member");
  calls = 0;
  await assert.rejects(retryDatabaseRead(async () => {
    calls += 1;
    throw Object.assign(new Error("missing column"), { code: "42703" });
  }, noWait), /missing column/);
  assert.equal(calls, 1);
});

test("all eight section screens reuse the authenticated member rather than blocking on /me", () => {
  for (const file of ["finance.tsx", "RentalsSection.tsx", "MachinerySection.tsx", "ChequesSection.tsx",
    "InventorySection.tsx", "AuditLogSection.tsx", "FieldExpensesSection.tsx", "[section].tsx"]) {
    const source = readFileSync(`app/section/${file}`, "utf8");
    assert.ok(!source.includes('"/me"'), file);
    assert.ok(source.includes("getMember()"), file);
  }
});

test("readiness checks verify the actual account projection without reading personal records", {
  skip: !(process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL),
}, async () => {
  const client = new pg.Client({ connectionString: process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query("BEGIN READ ONLY");
    // Intentionally do not set search_path: member reads must work on pooled connections.
    await client.query("SET LOCAL search_path TO public");
    assert.equal((await client.query(memberReadinessQuery)).rows.length, 0);
    await client.query(`EXPLAIN ${memberLookupQuery}`, ["nonexistent-loading-test-member"]);
    await client.query("ROLLBACK");
  } finally { await client.end(); }
});
