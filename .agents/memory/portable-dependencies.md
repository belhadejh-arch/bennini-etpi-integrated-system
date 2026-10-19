---
name: Portable dependency sources
description: Keep dependency lockfiles usable by the external Render and Vercel build environments.
---

After adding dependencies in this workspace, verify that lockfile download URLs remain publicly resolvable without changing package versions or integrity hashes.

**Why:** The workspace package installer can record internal package-firewall download hosts; external Render and Vercel builders cannot resolve them.

**How to apply:** Check source-host portability before delivery after every dependency installation. This does not permit bypassing a package security rejection. Verify public tarballs against the recorded integrity values when correcting source metadata.
