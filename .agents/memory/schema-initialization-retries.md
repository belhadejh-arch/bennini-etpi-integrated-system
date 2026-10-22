---
name: Schema initialization retries
description: Recovery behavior for lazy PostgreSQL schema setup used by API endpoints.
---

When caching a lazy schema-initialization promise, retry one transient failure and clear a failed promise after a short cooldown. Do not keep a rejected promise cached for the lifetime of the API process.

**Why:** One failed setup promise caused account, member, and field-related requests to keep failing even after database connectivity recovered. A basic `SELECT 1` health check can still pass while these schema-dependent endpoints are broken.

**How to apply:** Use the shared retryable schema cache for new lazy setup work. Keep retries bounded so a persistent schema or permission error does not create a query storm, and inspect server logs for the underlying database exception.

For inventory purchases, retry the transaction at most once only after PostgreSQL reports a missing schema, relation, or column. Roll back and release the original transaction before applying the idempotent schema scripts and retrying. Never replay validation, constraint, or network errors.

**Why:** Production showed schema drift, but replaying an ambiguous or already-committed financial write could create a duplicate purchase.

**How to apply:** Keep automatic recovery limited to PostgreSQL codes `3F000`, `42P01`, and `42703`; log the request ID and original database error so any remaining failure can be traced.

Explicitly cast bind parameters before combining them in PostgreSQL arithmetic expressions, including `INSERT ... VALUES` expressions; the target column may not supply enough context to resolve an operator.

**Why:** PostgreSQL reported `operator is not unique: unknown * unknown` for the inventory total when quantity and unit price were multiplied directly as untyped parameters.

**How to apply:** Cast quantities to `integer` and monetary operands to `numeric` in the SQL expression; do not rely on implicit parameter inference.
