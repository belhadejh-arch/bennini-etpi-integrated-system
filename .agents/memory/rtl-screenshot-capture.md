---
name: RTL screenshot capture
description: False horizontal displacement in Chromium full-page screenshots of the RTL application.
---

Chromium's full-page screenshot mode can show a wide white strip on the left and crop the right half of this RTL application even when its actual viewport rendering is correct.

**Why:** Comparing both modes on the same unchanged mobile page showed a normal viewport capture and a displaced full-page capture, while scrollX was zero and root/body bounds exactly matched the viewport.

**How to apply:** Use viewport screenshots and scroll the app's internal content container to inspect lower content. Check element bounds and horizontal overflow before treating a full-page capture as evidence of a real layout defect, especially when investigating native-window white strips.
