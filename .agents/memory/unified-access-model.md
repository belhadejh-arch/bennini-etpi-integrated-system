---
name: Unified access model
description: The intended sign-in and role-specific dashboard behavior for BENNINI ETPI.
---

All staff use one shared platform and sign-in entry. After login, users receive the same home route, with dashboard content and visible sections limited to their assigned permissions.

Use simple on/off switches with clear active/inactive labels for account activation and permission settings. Keep unrelated actions and multi-state workflow controls as their appropriate controls.

**Why:** The user explicitly requires one unified interface and platform, with dashboards and visible sections differing by each user's permissions, and selected simple switches for account status and permissions.

**How to apply:** Do not create separate role-specific apps or login flows. Keep section access consistent between navigation, dashboard widgets, and server-side API authorization. Use binary switches for account and permission controls; do not convert save/delete/navigation actions or multi-state workflow statuses into binary toggles.
