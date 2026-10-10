---
name: Unified access model
description: The intended sign-in and role-specific dashboard behavior for BENNINI ETPI.
---

All staff use one shared platform and sign-in entry. After login, users receive the same home route, with dashboard content and visible sections limited to their assigned permissions.

The existing administrator account must display the role name “Superadmin” while retaining its administrator-level access.

**Why:** The user explicitly requires one unified interface and platform, with dashboards and visible sections differing by each user's permissions.

**How to apply:** Do not create separate role-specific apps or login flows. Keep section access consistent between navigation, dashboard widgets, and server-side API authorization; do not reduce the existing administrator's access when updating its role label.
