import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import pg from "pg";
import { applyDailyShiftBulk, rentalCalculation, rentalDays, validDailyShifts, validRentalDate, rentalToday } from "../../shared/rental-calculation";
import { validRental, openRentalRefresher } from "../rental-data";

const input = {
  machineryId: 1, equipment: "حفارة", clientOrOwner: "مؤجر",
  startDate: "2026-10-01", endDate: "2026-10-05", ratePeriod: "shift",
  rentalRate: 1000, paidAmount: 500, status: "active", notes: "",
};

test("inclusive dates handle month/year/leap transitions and reject invalid ranges", () => {
  assert.equal(validRentalDate("2026-02-30"), false);
  assert.equal(validRentalDate(""), false);
  assert.equal(validRentalDate("2024-02-29"), true);
  assert.deepEqual(rentalDays("2026-12-31", "2027-01-01"), ["2026-12-31", "2027-01-01"]);
  assert.equal(rentalDays("2026-10-05", "2026-10-01").length, 0);
  assert.equal(rentalDays("2024-02-28", "2024-03-01").length, 3);
});

test("all presets, custom fractions, defaults and zero days calculate correctly", () => {
  const dailyShifts = [1, 1.5, 2, 3, 0, 0.25].map((shifts, index) => ({
    date: `2026-10-0${index + 1}`, shifts,
  }));
  const result = rentalCalculation("2026-10-01", "2026-10-07", "shift", 1000, dailyShifts);
  assert.equal(result.days, 7);
  assert.equal(result.totalShifts, 8.75);
  assert.equal(result.totalAmount, 8750);
  assert.equal(result.rows[6].shifts, 1);
  assert.equal(rentalCalculation("2026-10-01", "2026-10-01", "shift", 1000, [{ date: "2026-10-01", shifts: 0 }]).totalAmount, 0);
});

test("legacy daily/monthly durations are unchanged", () => {
  assert.equal(rentalCalculation("2026-10-01", "2026-10-01", "daily", 100).totalAmount, 100);
  assert.equal(rentalCalculation("2026-10-01", "2026-10-05", "daily", 100).duration, 4);
  assert.equal(rentalCalculation("2026-10-01", "2026-10-31", "monthly", 100).duration, 1);
  assert.equal(rentalCalculation("2026-10-01", "2026-11-01", "monthly", 100).duration, 2);
});

test("ongoing table grows each day without overwriting historic edits", () => {
  const rows = [{ date: "2026-10-01", shifts: 0, holiday: true }];
  const first = rentalCalculation("2026-10-01", null, "shift", 100, rows, "2026-10-02");
  const next = rentalCalculation("2026-10-01", null, "shift", 100, rows, "2026-10-03");
  assert.equal(first.totalAmount, 100);
  assert.equal(next.totalAmount, 200);
  assert.equal(next.rows[0].holiday, true);
  assert.equal(next.rows[0].shifts, 0);
  assert.equal(rentalCalculation("2027-01-01", null, "shift", 100, [], "2026-10-03").days, 0);
});

test("bulk all/selected applies across pages with independent Friday and holiday exclusions", () => {
  const rows = rentalCalculation("2026-10-01", "2026-10-31", "shift", 1).rows;
  rows[2].holiday = true;
  const all = applyDailyShiftBulk(rows, 2, null, true, true);
  assert.equal(all[0].shifts, 2);
  assert.equal(all[1].shifts, 1); // Friday
  assert.equal(all[2].shifts, 1); // Manually designated holiday
  assert.equal(all[30].shifts, 2); // A different page
  const selected = applyDailyShiftBulk(rows, 0, [rows[0].date, rows[30].date], false, false);
  assert.equal(selected[0].shifts, 0);
  assert.equal(selected[1].shifts, 1);
  assert.equal(selected[30].shifts, 0);
  assert.equal(rows[0].shifts, 1); // immutable
});

test("server rejects invalid dates/shifts, duplicate days and spoofed totals", () => {
  assert.equal(validRental({ ...input, endDate: "2026-09-30" }), null);
  assert.equal(validRental({ ...input, startDate: "" }), null);
  assert.equal(validRental({ ...input, dailyShifts: [{ date: "2026-10-01", shifts: -1 }] }), null);
  assert.equal(validDailyShifts([{ date: "2026-10-01", shifts: 4 }]), false);
  assert.equal(validDailyShifts([{ date: "2026-10-01", shifts: "1" }]), false);
  assert.equal(validDailyShifts([{ date: "2026-10-01", shifts: 1 }, { date: "2026-10-01", shifts: 2 }]), false);
  assert.equal(validRental({ ...input, totalAmount: 1 })?.totalAmount, 5000);
});

test("partial updates preserve shifts, explicit null clears end, and open rentals stay active", () => {
  const existing = validRental({ ...input, dailyShifts: [{ date: "2026-10-01", shifts: 2 }] })!;
  assert.equal(validRental({ notes: "تعديل" }, existing)?.totalAmount, 6000);
  const open = validRental({ endDate: null, status: "completed" }, existing)!;
  assert.equal(open.endDate, null);
  assert.equal(open.status, "active");
  assert.deepEqual(open.dailyShifts, existing.dailyShifts);
  assert.equal(validRental({ ...input, paidAmount: 9999 })?.paidAmount, 9999);
  assert.equal(validRental({ ...input, ratePeriod: "daily", paidAmount: 9999 }), null);
});

test("PostgreSQL round-trip and automatic open-contract accrual preserve saved days", {
  skip: !(process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL),
}, async () => {
  const schema = `test_rentals_${randomUUID().replaceAll("-", "")}`;
  const pool = new pg.Pool({ connectionString: process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL, max: 1 });
  try {
    await pool.query(`CREATE SCHEMA ${schema}`);
    await pool.query(`SET search_path TO ${schema}, public`);
    await pool.query(readFileSync("server/schema.sql", "utf8"));
    const today = rentalToday();
    const yesterday = new Date(Date.parse(today) - 86400000).toISOString().slice(0, 10);
    const dailyShifts = [{ date: yesterday, shifts: 1.5, holiday: true }];
    const { rows } = await pool.query(`INSERT INTO rentals(equipment,client_or_owner,start_date,end_date,
      total_amount,rate_period,rental_rate,daily_shifts)
      VALUES ('آلة','مؤجر',$1,NULL,0,'shift',1000,$2::jsonb) RETURNING id`, [yesterday, JSON.stringify(dailyShifts)]);
    await openRentalRefresher(pool)();
    const saved = (await pool.query("SELECT * FROM rentals WHERE id=$1", [rows[0].id])).rows[0];
    assert.deepEqual(saved.daily_shifts, dailyShifts);
    assert.equal(saved.duration, 2);
    assert.equal(Number(saved.total_amount), 2500);
    assert.equal(saved.status, "active");
    assert.equal(saved.end_date, null);
    // Editing yesterday persists and is used on the next accrual pass.
    await pool.query("UPDATE rentals SET daily_shifts=$1::jsonb WHERE id=$2",
      [JSON.stringify([{ date: yesterday, shifts: 0, holiday: true }]), saved.id]);
    await openRentalRefresher(pool)();
    assert.equal(Number((await pool.query("SELECT total_amount FROM rentals WHERE id=$1", [saved.id])).rows[0].total_amount), 1000);
    // Closing does not get overwritten by the automatic open-contract refresh.
    await pool.query("UPDATE rentals SET end_date=$1,status='completed',total_amount=777 WHERE id=$2", [today, saved.id]);
    await openRentalRefresher(pool)();
    assert.equal(Number((await pool.query("SELECT total_amount FROM rentals WHERE id=$1", [saved.id])).rows[0].total_amount), 777);
  } finally {
    await pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await pool.end();
  }
});
