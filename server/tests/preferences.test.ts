import { strict as assert } from "node:assert";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import express, { type RequestHandler } from "express";
import pg from "pg";
import { parsePreferences, registerPreferencesRoutes } from "../preferences-routes";
import type { AuthenticatedRequest } from "../index";

test("preferences accept only explicit languages and appearances, never identity or permissions", () => {
  assert.deepEqual(parsePreferences({ language: "fr", appearance: "system" }), { language: "fr", appearance: "system" });
  for (const body of [null, [], {}, { language: "en" }, { appearance: "auto" },
    { appearance: null }, { language: ["ar"] }, { language: "fr", memberId: "other" },
    { language: "fr", role: "admin" }]) {
    assert.throws(() => parsePreferences(body), /لغة/);
  }
});

test("account preferences persist independently for every role in isolated PostgreSQL", {
  skip: !(process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL),
}, async (t) => {
  const schema = `test_preferences_${randomUUID().replaceAll("-", "")}`;
  const pool = new pg.Pool({
    connectionString: process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL,
    onConnect: async (client) => { await client.query(`SET search_path TO ${schema}, public`); },
  });
  let listener: ReturnType<ReturnType<typeof express>["listen"]> | undefined;
  try {
    await pool.query(`CREATE SCHEMA ${schema}`);
    await pool.query(readFileSync("server/schema.sql", "utf8"));
    await pool.query(`INSERT INTO members(clerk_user_id,name,role,active)
      VALUES ('a','اختبار','admin',TRUE),('b','Test','partner',TRUE),('c','Field','field',TRUE)`);
    const app = express();
    app.use(express.json());
    const auth: RequestHandler = async (request, response, next) => {
      const result = await pool.query("SELECT * FROM members WHERE clerk_user_id = $1", [request.header("x-test-member") ?? ""]);
      if (!result.rowCount) { response.status(401).json({ error: "Unauthorized" }); return; }
      (request as AuthenticatedRequest).member = result.rows[0];
      next();
    };
    registerPreferencesRoutes(app, pool, auth);
    listener = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve) => listener!.once("listening", resolve));
    const address = listener.address();
    assert.ok(address && typeof address !== "string");
    const endpoint = `http://127.0.0.1:${address.port}/api/me/preferences`;
    const patch = (member: string, data: unknown) => fetch(endpoint, { method: "PATCH",
      headers: { "Content-Type": "application/json", "x-test-member": member }, body: JSON.stringify(data) });
    await t.test("all new and existing accounts default to Arabic and light", async () => {
      const result = await pool.query("SELECT language,appearance FROM members");
      for (const row of result.rows) assert.deepEqual(row, { language: "ar", appearance: "light" });
    });
    await t.test("partner can save French and dark without changing identity or other accounts", async () => {
      const response = await patch("b", { language: "fr", appearance: "dark" });
      assert.equal(response.status, 200);
      const { member } = await response.json();
      assert.equal(member.clerk_user_id, "b");
      assert.equal(member.language, "fr");
      assert.equal(member.appearance, "dark");
      assert.equal(member.role, "partner");
      const others = await pool.query("SELECT language,appearance FROM members WHERE clerk_user_id <> 'b'");
      for (const row of others.rows) assert.deepEqual(row, { language: "ar", appearance: "light" });
    });
    await t.test("partial updates preserve language, data and persist through reload", async () => {
      assert.equal((await patch("b", { appearance: "system" })).status, 200);
      const result = await pool.query("SELECT name,language,appearance FROM members WHERE clerk_user_id='b'");
      assert.deepEqual(result.rows[0], { name: "Test", language: "fr", appearance: "system" });
    });
    await t.test("no account can override another member or bypass validation", async () => {
      assert.equal((await patch("b", { language: "ar", memberId: "a" })).status, 400);
      assert.equal((await patch("a", { appearance: "invalid" })).status, 400);
      assert.equal((await patch("", { appearance: "dark" })).status, 401);
    });
  } finally {
    if (listener) await new Promise<void>((resolve) => listener!.close(() => resolve()));
    await pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await pool.end();
  }
});
