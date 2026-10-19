import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
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
