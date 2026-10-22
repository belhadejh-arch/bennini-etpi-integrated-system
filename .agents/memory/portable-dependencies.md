---
name: Portable dependency sources
description: Keep dependency lockfiles usable by the external Render and Vercel build environments.
---

After adding dependencies in this workspace, verify that lockfile download URLs remain publicly resolvable without changing package versions or integrity hashes.

**Why:** The workspace package installer can record internal package-firewall download hosts; external Render and Vercel builders cannot resolve them.

**How to apply:** Check source-host portability before delivery after every dependency installation. This does not permit bypassing a package security rejection. Verify public tarballs against the recorded integrity values when correcting source metadata.

Production PDF generation must not depend on Replit's system browser.

**Why:** Browser availability and native libraries differ between the Nix workspace and Node/Render hosts. A passing workspace browser test did not prove deployability; repeated PDF failures required removing that runtime dependency.

**How to apply:** Keep production report rendering browser-free and isolated from financial API work. Chromium can remain a development verification tool, not a production prerequisite.

ESM-only PDF dependencies must be imported from the actual ESM worker, not dynamically resolved inside a CJS module loaded through tsImport.

**Why:** tsImport can use a data URL for CJS modules; resolving a bare ESM package there fails even though normal imports work in the main process.

**How to apply:** Let the real-file ESM worker own ESM dependencies and pass their module API into the typed report renderer.
