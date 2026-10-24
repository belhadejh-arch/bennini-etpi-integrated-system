---
name: Production database boundaries
description: Safety constraints for destructive changes on the external Neon production database.
---

The production Neon database contains multiple schemas and additional tables not defined by this application. Destructive operations must use explicit `bennini` schema qualification and a reviewed table allowlist; never truncate the database or rely on cascading deletes.

**Why:** Other records coexist in the same database, and an external referral-commission table can reference the application's transaction ledger.

**How to apply:** Before a production reset, inspect foreign keys into the target tables, preserve `members` and user preferences when requested, and leave `public` plus unknown tables untouched unless the user explicitly authorizes them.
