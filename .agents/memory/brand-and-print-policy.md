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

The mobile WebView wrapper is generated using **Median.co**, as identified by the user. PDF preview and printing must work there, not just in a desktop browser.

**Why:** Median's native downloader cannot consume a page-local Blob URL or forward the site's Bearer header. Its documented native PDF viewer provides the Print action.

**How to apply:** Use in-page PDF rendering plus the documented Median native viewer/download integration with short-lived document-scoped URLs. Do not promise physical-device verification based only on a browser simulation.
