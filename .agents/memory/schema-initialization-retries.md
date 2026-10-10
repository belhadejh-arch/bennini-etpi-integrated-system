---
name: Schema initialization retries
description: Recovery behavior for lazy PostgreSQL schema setup used by API endpoints.
---

When caching a lazy schema-initialization promise, retry one transient failure and clear a failed promise after a short cooldown. Do not keep a rejected promise cached for the lifetime of the API process.

**Why:** One failed setup promise caused account, member, and field-related requests to keep failing even after database connectivity recovered. A basic `SELECT 1` health check can still pass while these schema-dependent endpoints are broken.

**How to apply:** Use the shared retryable schema cache for new lazy setup work. Keep retries bounded so a persistent schema or permission error does not create a query storm, and inspect server logs for the underlying database exception.
