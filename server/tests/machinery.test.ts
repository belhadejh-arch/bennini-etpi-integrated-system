import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import pg from "pg";
import { driverCostsByMachinery, type DriverAssignmentCostRow } from "../machinery-costs";

const assignment = (overrides: Partial<DriverAssignmentCostRow> = {}): DriverAssignmentCostRow => ({
  machinery_id: 1, monthly_salary: 31000, start_date: "2026-01-01", end_date: null, ...overrides,
});

test("a complete month accrues exactly one monthly salary", () => {
  assert.equal(driverCostsByMachinery([assignment()], "2026-01-31").get(1), 31000);
});

test("partial months use the actual number of calendar days", () => {
  assert.equal(driverCostsByMachinery([assignment({ start_date: "2026-01-16" })], "2026-01-31").get(1), 16000);
  assert.equal(driverCostsByMachinery([assignment({ monthly_salary: 29000, start_date: "2024-02-01" })], "2024-02-29").get(1), 29000);
});

test("previous and replacement drivers accrue without overlapping dates", () => {
  const rows = [
    assignment({ end_date: "2026-01-15" }),
    assignment({ start_date: "2026-01-16", monthly_salary: 62000 }),
  ];
  assert.equal(driverCostsByMachinery(rows, "2026-01-31").get(1), 47000);
});

test("future dates never accrue salary early", () => {
  assert.equal(driverCostsByMachinery([assignment({ end_date: "2026-02-28" })], "2026-01-15").get(1), 15000);
  assert.equal(driverCostsByMachinery([assignment({ start_date: "2026-02-01" })], "2026-01-15").get(1), undefined);
});

test("costs stay isolated by stable machinery ID", () => {
  const costs = driverCostsByMachinery([assignment(), assignment({ machinery_id: "2", monthly_salary: "62000" })], "2026-01-31");
  assert.equal(costs.get(1), 31000);
  assert.equal(costs.get(2), 62000);
});

test("parts and repair counters use field records without losing legacy costs or double counting", {
  skip: !(process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL),
}, async () => {
  const schema = `test_machinery_${randomUUID().replaceAll("-", "")}`;
  const client = new pg.Client({ connectionString: process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query(`CREATE SCHEMA ${schema}`);
    await client.query(`SET search_path TO ${schema}, public`);
    await client.query(readFileSync("server/schema.sql", "utf8"));
    await client.query("INSERT INTO members(clerk_user_id,name) VALUES ('test','مستخدم')");
    await client.query(`INSERT INTO machinery(code,name) VALUES ('A','الآلة الأولى'),('B','الآلة الثانية')`);
    const machines = await client.query("SELECT id FROM machinery ORDER BY code");
    const a = machines.rows[0].id, b = machines.rows[1].id;
    await client.query(`INSERT INTO machinery_spare_parts
      (machinery_id,name,quantity,buy_price,stock_quantity,repair_expense,recorded_by_id,recorded_by_name)
      VALUES ($1,'سجل قديم',2,50,0,20,'test','مستخدم'),($1,'سجل قديم آخر',1,30,0,0,'test','مستخدم')`, [a]);
    await client.query(`INSERT INTO field_expenses(machinery_id,category,amount,site_name,created_by_id,created_by_name)
      VALUES ($1,'قطع غيار',200,'موقع','test','مستخدم'),($1,'إصلاح آلية',300,'موقع','test','مستخدم'),
        ($1,'مازوت',100,'موقع','test','مستخدم'),($2,'قطع غيار',999,'موقع','test','مستخدم')`, [a, b]);
    await client.query(`INSERT INTO rentals(machinery_id,equipment,client_or_owner,end_date,total_amount)
      VALUES ($1,'الآلة الأولى','مؤجر','2026-12-31',400)`, [a]);
    const source = readFileSync("server/index.ts", "utf8").slice(readFileSync("server/index.ts", "utf8").indexOf("async function loadMachineryFinancialSummary("));
    const query = source.match(/SELECT m\.id, m\.code[\s\S]*?ORDER BY m\.code, m\.id/)?.[0];
    assert.ok(query);
    const result = await client.query(query);
    const machineA = result.rows.find((row) => String(row.id) === String(a));
    const machineB = result.rows.find((row) => String(row.id) === String(b));
    assert.equal(machineA.repair_count, 2);
    assert.equal(machineA.legacy_repair_count, 2);
    assert.equal(Number(machineA.total_expenses), 1150);
    assert.equal(machineB.repair_count, 1);
    assert.equal(Number(machineB.total_expenses), 999);
    // A rename cannot sever the ID-based operational history.
    await client.query("UPDATE machinery SET name='اسم جديد' WHERE id=$1", [a]);
    const renamed = (await client.query(query)).rows.find((row) => String(row.id) === String(a));
    assert.equal(renamed.repair_count, 2);
    assert.equal(Number(renamed.total_expenses), 1150);
  } finally {
    await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await client.end();
  }
});

test("aggregation and salary-alert queries are valid in PostgreSQL (read-only)", {
  skip: !(process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL),
}, async () => {
  const client = new pg.Client({ connectionString: process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query("BEGIN READ ONLY");
    await client.query("SET LOCAL search_path TO bennini, public");
    const source = readFileSync("server/index.ts", "utf8");
    const notificationSql = source.match(/WITH current_month AS \([\s\S]*?LIMIT 30\n\s*`/);
    assert.ok(notificationSql);
    await client.query(`EXPLAIN ${notificationSql[0].replace(/`\s*$/, "")}`);
    const machineryRoute = source.slice(source.indexOf("async function loadMachineryFinancialSummary("));
    const aggregationSql = machineryRoute.match(/SELECT m\.id, m\.code[\s\S]*?ORDER BY m\.code, m\.id/);
    assert.ok(aggregationSql);
    await client.query(`EXPLAIN ${aggregationSql[0]}`);
    const constraints = await client.query(`
      SELECT conrelid::regclass::text AS name FROM pg_constraint
      WHERE contype = 'f' AND confrelid = 'machinery'::regclass AND confdeltype = 'r'
    `);
    for (const table of ["rentals", "field_expenses", "machinery_spare_parts", "machinery_driver_assignments"]) {
      assert.ok(constraints.rows.some((row) => String(row.name).split(".").pop() === table), `${table} must prevent linked machinery deletion`);
    }
  } finally {
    await client.query("ROLLBACK");
    await client.end();
  }
});
