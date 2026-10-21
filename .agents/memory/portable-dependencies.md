---
name: Portable dependency sources
description: Keep dependency lockfiles usable by the external Render and Vercel build environments.
---

After adding dependencies in this workspace, verify that lockfile download URLs remain publicly resolvable without changing package versions or integrity hashes.

**Why:** The workspace package installer can record internal package-firewall download hosts; external Render and Vercel builders cannot resolve them.

**How to apply:** Check source-host portability before delivery after every dependency installation. This does not permit bypassing a package security rejection. Verify public tarballs against the recorded integrity values when correcting source metadata.

PDF browser provisioning must be explicit on external hosts, not assumed from a successful Replit preview.

**Why:** Replit's Nix Chromium is not present in a separately built Node/Render service. An installed Puppeteer client alone does not provide a browser executable.

**How to apply:** Provision the matching browser during the external build, while retaining the system browser where available. Treat downloaded browser binaries as generated build artifacts, never Git assets, and verify library revision exports/types when upgrading Puppeteer.
