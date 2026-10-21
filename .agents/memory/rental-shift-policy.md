---
name: Rental shift rules
description: Product conventions for eight-hour rental shifts, open contracts and existing rate calculations.
---

Shift rentals count every calendar day inclusively, defaulting to one eight-hour shift. The requested presets are 1, 1.5, 2, 3 and 0; historic daily edits must persist and immediately affect the amount. Open-ended contracts remain active and accrue through the current day.

**Why:** The user explicitly requested inclusive daily rows, default normal days, persistent historical corrections and automatic ongoing accrual while preserving existing daily/monthly behavior.

**How to apply:** Keep the shift calendar convention separate from legacy elapsed-day daily/monthly billing. Refresh ongoing amounts for all financial consumers, not only when viewing the rental editor.

Friday and holiday exclusions apply only to bulk changes; they do not silently zero normal days. Holidays are explicitly designated per day rather than inferred from an unconfirmed national holiday calendar.

**Why:** The user requested the ability to exclude Fridays and holidays from bulk application, not automatic deductions or a particular holiday authority.

**How to apply:** Preserve individual day overrides, and allow each bulk exclusion to be chosen independently.
