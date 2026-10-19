export type DriverAssignmentCostRow = {
  machinery_id: number | string;
  monthly_salary: number | string;
  start_date: string;
  end_date: string | null;
};

// Salary accrues through the end of today, prorated by each calendar month's days.
export function driverCostsByMachinery(rows: DriverAssignmentCostRow[], today = new Date().toISOString().slice(0, 10)) {
  const totals = new Map<number, number>();
  const todayMs = Date.parse(`${today}T00:00:00.000Z`);
  for (const row of rows) {
    const startMs = Date.parse(`${String(row.start_date).slice(0, 10)}T00:00:00.000Z`);
    const endValue = row.end_date ? String(row.end_date).slice(0, 10) : today;
    const endMs = Math.min(Date.parse(`${endValue}T00:00:00.000Z`), todayMs);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) continue;
    let cursor = new Date(Date.UTC(new Date(startMs).getUTCFullYear(), new Date(startMs).getUTCMonth(), 1));
    let cost = 0;
    while (cursor.getTime() <= endMs) {
      const year = cursor.getUTCFullYear();
      const month = cursor.getUTCMonth();
      const monthStart = Date.UTC(year, month, 1);
      const nextMonth = Date.UTC(year, month + 1, 1);
      const coveredStart = Math.max(startMs, monthStart);
      const coveredEnd = Math.min(endMs, nextMonth - 86400000);
      if (coveredEnd >= coveredStart) {
        const daysInMonth = (nextMonth - monthStart) / 86400000;
        const daysCovered = Math.floor((coveredEnd - coveredStart) / 86400000) + 1;
        cost += Number(row.monthly_salary) * daysCovered / daysInMonth;
      }
      cursor = new Date(nextMonth);
    }
    const machineId = Number(row.machinery_id);
    totals.set(machineId, (totals.get(machineId) ?? 0) + cost);
  }
  for (const [id, total] of totals) totals.set(id, Math.round(total * 100) / 100);
  return totals;
}
