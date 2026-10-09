---
name: Neon pooled connections
description: Neon pooler behavior when configuring PostgreSQL schema search paths.
---

Do not pass a PostgreSQL `options=-c search_path=...` startup parameter when using a Neon pooled endpoint; the pooler may reject it as unsupported. Set the path using an awaited `onConnect` hook in `pg.Pool`, so initialization completes before that connection is handed to an application query.

**Why:** Neon returned `unsupported startup parameter in options: search_path`. A synchronous pool `connect` event also let an application query overlap the setup query and raised a driver deprecation warning.

**How to apply:** when a Bennini database pool uses a Neon pooled URL, configure `search_path` in its awaited connection hook and confirm startup plus an API query against the initialized schema.
