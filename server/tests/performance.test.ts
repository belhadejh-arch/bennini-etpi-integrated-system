import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import pg from "pg";

test("machinery summary scans operation tables once and retains identical totals at scale", {
  skip: !(process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL),
}, async (context) => {
  const client = new pg.Client({ connectionString: process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL });
  const schema = `test_speed_${randomUUID().replaceAll("-", "")}`;
  await client.connect();
  try {
    await client.query(`CREATE SCHEMA ${schema}; SET search_path TO ${schema};
      CREATE TABLE machinery (id int PRIMARY KEY, code text, name text, category text, status text, hours_worked numeric, notes text);
      CREATE TABLE machinery_spare_parts (machinery_id int, quantity numeric, buy_price numeric, repair_expense numeric);
      CREATE TABLE field_expenses (machinery_id int, category text, amount numeric);
      CREATE TABLE rentals (machinery_id int, total_amount numeric);
      CREATE TABLE machinery_driver_assignments (id int, machinery_id int, driver_name text, monthly_salary numeric, start_date date, end_date date);
      INSERT INTO machinery SELECT i, i::text, 'Test', '', 'active', 0, '' FROM generate_series(1,301) i;
      INSERT INTO field_expenses SELECT m, CASE WHEN e % 2 = 0 THEN 'قطع غيار' ELSE 'وقود' END, 100
        FROM generate_series(1,300) m CROSS JOIN generate_series(1,20) e;
      INSERT INTO machinery_spare_parts SELECT m, 2, 10, 50 FROM generate_series(1,300) m CROSS JOIN generate_series(1,5) e;
      INSERT INTO rentals SELECT m, 500 FROM generate_series(1,300) m CROSS JOIN generate_series(1,4) e;
      ANALYZE machinery; ANALYZE field_expenses; ANALYZE machinery_spare_parts; ANALYZE rentals;`);
    const source = readFileSync("server/index.ts", "utf8");
    const query = source.slice(source.indexOf("async function loadMachineryFinancialSummary("))
      .match(/SELECT m\.id, m\.code[\s\S]*?ORDER BY m\.code, m\.id/)?.[0];
    assert.ok(query);
    const baseline = `SELECT m.id,
      (SELECT COUNT(*)::int FROM field_expenses e WHERE e.machinery_id=m.id AND category IN ('قطع غيار','إصلاح آلية')) AS repair_count,
      (SELECT COUNT(*)::int FROM machinery_spare_parts p WHERE p.machinery_id=m.id) AS legacy_repair_count,
      COALESCE((SELECT SUM(quantity*buy_price+repair_expense) FROM machinery_spare_parts p WHERE p.machinery_id=m.id),0)
        + COALESCE((SELECT SUM(amount) FROM field_expenses e WHERE e.machinery_id=m.id),0)
        + COALESCE((SELECT SUM(total_amount) FROM rentals r WHERE r.machinery_id=m.id),0) AS total_expenses
      FROM machinery m ORDER BY m.code,m.id`;
    const oldRows = (await client.query(baseline)).rows;
    const newRows = (await client.query(query)).rows.map(({ id, repair_count, legacy_repair_count, total_expenses }) =>
      ({ id, repair_count, legacy_repair_count, total_expenses }));
    assert.deepEqual(newRows, oldRows);
    const oldPlan = (await client.query(`EXPLAIN (ANALYZE, FORMAT JSON) ${baseline}`)).rows[0]["QUERY PLAN"][0];
    const plan = (await client.query(`EXPLAIN (ANALYZE, FORMAT JSON) ${query}`)).rows[0]["QUERY PLAN"][0];
    const scans: Record<string, number[]> = {};
    const visit = (node: Record<string, any>) => {
      if (node["Relation Name"]) (scans[node["Relation Name"]] ??= []).push(node["Actual Loops"]);
      for (const child of node.Plans ?? []) visit(child);
    };
    visit(plan.Plan);
    for (const table of ["field_expenses", "machinery_spare_parts", "rentals"]) assert.deepEqual(scans[table], [1]);
    context.diagnostic(`Isolated fixture: 301 machines, 6000 field operations. Previous plan ${oldPlan["Execution Time"]}ms; grouped plan ${plan["Execution Time"]}ms. Totals identical.`);
  } finally {
    await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await client.end();
  }
});
