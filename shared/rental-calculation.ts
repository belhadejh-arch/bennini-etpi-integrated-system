export type RatePeriod = "daily" | "monthly" | "shift";
export type DailyShift = { date: string; shifts: number; holiday?: boolean };

export function rentalToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Algiers", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

export function validRentalDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

// Shift dates are inclusive. Existing daily/monthly contracts retain their elapsed-day convention.
export function rentalDays(start: string, end: string): string[] {
  if (!validRentalDate(start) || !validRentalDate(end) || end < start) return [];
  const count = Math.round((Date.parse(end) - Date.parse(start)) / 86400000) + 1;
  if (count > 36600) return [];
  return Array.from({ length: count }, (_, index) =>
    new Date(Date.parse(`${start}T00:00:00Z`) + index * 86400000).toISOString().slice(0, 10));
}

export function rentalCalculation(
  start: string, end: string | null, period: RatePeriod, rate: number,
  dailyShifts: DailyShift[] = [], today = rentalToday(),
) {
  const dates = rentalDays(start, end || today);
  const saved = new Map(dailyShifts.map((row) => [row.date, row]));
  const rows = dates.map((date) => ({
    date, shifts: saved.get(date)?.shifts ?? 1, holiday: saved.get(date)?.holiday ?? false,
  }));
  const totalShifts = Math.round(rows.reduce((sum, row) => sum + row.shifts, 0) * 10000) / 10000;
  const elapsedDays = dates.length ? Math.max(1, dates.length - 1) : 0;
  const duration = period === "shift" ? dates.length :
    period === "monthly" ? Math.ceil(elapsedDays / 30) : elapsedDays;
  const units = period === "shift" ? totalShifts : duration;
  return { rows, days: dates.length, totalShifts, duration, totalAmount: Math.round(units * rate * 100) / 100 };
}

export function validDailyShifts(value: unknown): value is DailyShift[] {
  if (!Array.isArray(value) || value.length > 36600) return false;
  const dates = new Set<string>();
  return value.every((row) => {
    if (!row || typeof row !== "object" || !validRentalDate(row.date) ||
        typeof row.shifts !== "number" || !Number.isFinite(row.shifts) || row.shifts < 0 || row.shifts > 3 ||
        (row.holiday !== undefined && typeof row.holiday !== "boolean") || dates.has(row.date)) return false;
    dates.add(row.date);
    return true;
  });
}

export function applyDailyShiftBulk(
  rows: DailyShift[], shifts: number, selectedDates: string[] | null,
  excludeFriday: boolean, excludeHoliday: boolean,
) {
  const selected = selectedDates === null ? null : new Set(selectedDates);
  return rows.map((row) => {
    const friday = new Date(`${row.date}T00:00:00Z`).getUTCDay() === 5;
    return (selected === null || selected.has(row.date)) &&
      !(excludeFriday && friday) && !(excludeHoliday && row.holiday) ? { ...row, shifts } : row;
  });
}
