---
name: PDF canvas direction in Arabic interfaces
description: Why PDF canvases need LTR even while the app and printed Arabic content remain RTL.
---

PDF.js drawing canvases must explicitly use LTR direction. Keep the surrounding Arabic interface RTL.

**Why:** Canvas text direction otherwise inherits the app's RTL document direction. PDF.js already positions the PDF glyphs; inherited RTL changes text anchor positions again, making letters overlap and punctuation disappear even when PDF bytes and extracted text are correct.

The localization build transform also rewrites explicit JSX `style.direction: "ltr"` to the current UI direction. A source-level LTR style was therefore still RTL in the compiled app.

**How to apply:** Use the canvas `dir` attribute and imperative drawing-context/DOM direction, not a localized JSX direction style. Apply this to previews and attachment-print raster canvases. Check compiled behavior and mixed Arabic/Latin/decimal rendering; PDF signatures and extracted text alone miss this failure.
