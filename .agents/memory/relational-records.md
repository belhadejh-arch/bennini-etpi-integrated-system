---
name: Relational records
description: Product requirement for persistent linked records and attributable operations.
---

Operational records should be persisted in the shared PostgreSQL database and connected with foreign keys where a real relationship exists. Preserve the authenticated member responsible for each submission. Do not treat mock data or local storage as the primary database. Field operations must remain visible to the main system without losing their submitter identity or being duplicated as a second record.

**Why:** the user explicitly requires one consistent data model, traceable ownership, and persistent shared records.

**How to apply:** when adding a workflow, define its database relationships and actor fields, keep each operation as a single source-of-truth record, and avoid client-only persistence or sample data as the system of record.
