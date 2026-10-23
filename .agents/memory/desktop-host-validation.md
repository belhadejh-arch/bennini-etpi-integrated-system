---
name: Desktop host validation
description: Windows desktop wrapper target and the boundary between web layout and native-window validation.
---

The user runs the platform in a Websktop desktop wrapper on Windows 10.

**Why:** The user explicitly identified this environment when reporting a bottom
white strip and required evidence separating website layout, wrapper chrome,
and the Windows taskbar.

**How to apply:** Treat native-host testing as separate from normal Chromium
tests. Do not claim a host issue resolved from website screenshots or hide
overflow/change colors to conceal it. Native configuration changes require the
actual wrapper configuration and evidence of the usable web-content bounds.
