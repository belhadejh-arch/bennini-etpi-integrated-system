---
name: Branding and printing scope
description: User requirements for the supplied BE identity and practical, complete printing across the business app.
---

Use the user's supplied white/yellow BE mark without redesigning or distorting it. Dashboard branding must have a transparent background. Use Changa and the supplied navy/yellow login and splash references on both phone and desktop.

Recovery-page reference images are layout references only: retain the previously supplied BE logo, not the different logo drawn in those images. On light surfaces, provide contrast around the original asset rather than recoloring or replacing the mark.

**Why:** The user explicitly repeated that the logo must not be changed when requesting the recovery-page redesign.

**Why:** The user explicitly requested this identity throughout the app, including the icon, launch screen, login and dashboard, and restricted work to the requested changes.

**How to apply:** Preserve proportions, support different screen sizes, and do not substitute a generic company icon or introduce unrelated visual changes.

Printing must be functional across business sections, support individual/selected/all records, retain all rows and columns, and include actual financial totals and rental daily shifts. Printed Arabic documents must be RTL, previewable, and usable as PDF.

**Why:** The user explicitly rejected a merely decorative print button and required accurate, complete final documents.

**How to apply:** Apply the same account permissions as the on-screen data; never print only the currently loaded page or silently crop wide tables. Native printer availability depends on the device's system printing service.

The supplied Android download was verified to be **AppCreator24**, despite the earlier Median description. Keep Median compatibility, but detect the actual wrapper rather than assuming its bridge exists.

**Why:** AppCreator24 prints the main WebView through its own native bridge; hidden iframe printing does not invoke it. Both wrappers need real HTTPS downloads rather than page-local Blob links.

**How to apply:** Preserve full report and attachment page coverage, scoped expiring file URLs and runtime bridge detection. Do not call browser simulation a physical-device test, or a workspace test proof that the existing published server was updated.
