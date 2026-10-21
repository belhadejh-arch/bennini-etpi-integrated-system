import type pg from "pg";
import {
  rentalCalculation, rentalToday, validDailyShifts, validRentalDate,
  type DailyShift, type RatePeriod,
} from "../shared/rental-calculation";

export type RentalInput = {
  machineryId: number | null; equipment: string; clientOrOwner: string;
  startDate: string; endDate: string | null; ratePeriod: RatePeriod;
  rentalRate: number; duration: number; totalAmount: number; paidAmount: number;
  status: "active" | "completed" | "cancelled"; notes: string; dailyShifts: DailyShift[];
};

export function validRental(body: Record<string, unknown>, existing?: Partial<RentalInput>): RentalInput | null {
  const rawMachineryId = body.machineryId === undefined ? existing?.machineryId : body.machineryId;
  const machineryId = rawMachineryId == null || rawMachineryId === "" ? null : Number(rawMachineryId);
  const equipment = String(body.equipment ?? existing?.equipment ?? "").trim();
  const clientOrOwner = String(body.clientOrOwner ?? existing?.clientOrOwner ?? "").trim();
  const startDate = body.startDate ?? existing?.startDate;
  const rawEnd = body.endDate === undefined ? existing?.endDate : body.endDate;
  const endDate = rawEnd === "" || rawEnd == null ? null : rawEnd;
  const ratePeriod = body.ratePeriod ?? existing?.ratePeriod ?? "daily";
  const rentalRate = Number(body.rentalRate ?? existing?.rentalRate ?? 0);
  const paidAmount = Number(body.paidAmount ?? existing?.paidAmount ?? 0);
  const status = endDate === null ? "active" : body.status ?? existing?.status ?? "active";
  const notes = String(body.notes ?? existing?.notes ?? "").trim();
  const dailyShifts = body.dailyShifts ?? existing?.dailyShifts ?? [];
  if ((machineryId !== null && (!Number.isSafeInteger(machineryId) || machineryId <= 0)) ||
      !equipment || equipment.length > 200 || !clientOrOwner || clientOrOwner.length > 200 ||
      typeof startDate !== "string" || !validRentalDate(startDate) ||
      (endDate !== null && (typeof endDate !== "string" || !validRentalDate(endDate) || endDate < startDate)) ||
      !["daily", "monthly", "shift"].includes(String(ratePeriod)) ||
      !Number.isFinite(rentalRate) || rentalRate < 0 || rentalRate > 999999999999 ||
      !Number.isFinite(paidAmount) || paidAmount < 0 || paidAmount > 99999999999999 ||
      !["active", "completed", "cancelled"].includes(String(status)) || notes.length > 5000 ||
      !validDailyShifts(dailyShifts)) return null;
  const calculation = rentalCalculation(startDate, endDate as string | null, ratePeriod as RatePeriod, rentalRate, dailyShifts);
  // An open contract starting in the future has no accrued shifts yet.
  if (!calculation.days && endDate !== null) return null;
  if (calculation.totalAmount > 99999999999999 ||
      (ratePeriod !== "shift" && paidAmount > calculation.totalAmount)) return null;
  return {
    machineryId, equipment, clientOrOwner, startDate, endDate: endDate as string | null,
    ratePeriod: ratePeriod as RatePeriod, rentalRate,
    duration: Math.max(1, calculation.duration), totalAmount: calculation.totalAmount, paidAmount,
    status: status as RentalInput["status"], notes, dailyShifts,
  };
}

// Refresh persisted accruals before the first API request each Algiers day, so dashboard,
// machinery and exports see the same amounts even if nobody opens the rental screen.
export function openRentalRefresher(pool: pg.Pool) {
  let refreshedDay = "";
  let pending: Promise<void> | null = null;
  return async () => {
    const today = rentalToday();
    if (refreshedDay === today) return;
    if (!pending) {
      pending = pool.query(`
        UPDATE rentals r SET
          duration = CASE WHEN rate_period = 'monthly'
            THEN GREATEST(1, CEIL(GREATEST(1, $1::date - start_date)::numeric / 30))::int
            WHEN rate_period = 'shift' THEN GREATEST(1, $1::date - start_date + 1)
            ELSE GREATEST(1, $1::date - start_date) END,
          total_amount = ROUND(rental_rate * CASE
            WHEN start_date > $1::date THEN 0
            WHEN rate_period = 'shift' THEN ($1::date - start_date + 1) + COALESCE((
              SELECT SUM((entry->>'shifts')::numeric - 1)
              FROM jsonb_array_elements(daily_shifts) entry
              WHERE (entry->>'date')::date BETWEEN start_date AND $1::date
            ), 0)
            WHEN rate_period = 'monthly' THEN CEIL(GREATEST(1, $1::date - start_date)::numeric / 30)
            ELSE GREATEST(1, $1::date - start_date) END, 2),
          status = 'active'
        WHERE end_date IS NULL
      `, [today]).then(() => { refreshedDay = today; }).finally(() => { pending = null; });
    }
    await pending;
  };
}
