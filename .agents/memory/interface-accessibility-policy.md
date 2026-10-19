---
name: Interface language and readability
description: User requirements for app-wide readability, bilingual display and opt-in appearance.
---

Apply readability improvements throughout the app, not only field review: secondary text should be at least 14px, no text below 12px, medium weight, comfortable line spacing, AA text contrast, and support for the phone's font size.

**Why:** The user explicitly reported small metadata, dates, empty-state text and placeholders as hard to read on phones.

**How to apply:** Check both themes, large system text and Arabic/French layouts when introducing screens. Avoid controls with fixed heights that clip scaled text.

Arabic and light appearance are the defaults. French and dark/system appearance are optional per-account choices. Switching must not reload the page, sign out, or discard current input. User-written names and notes must remain untouched by translation.

**Why:** The user explicitly requested account-persistent choices, immediate appearance changes, and no automatic translation of entered data.

**How to apply:** Translate interface messages and enum display labels only. Keep stored values and record content unchanged.

Native theme and language values must be activated before context consumers render; updating a global palette only in an effect can leave the native screen styled with the previous selection even though the context value changed.

**Why:** Web CSS variables update independently, but native module-level styles capture actual colors and do not get that behavior.

**How to apply:** Verify a mounted native-style reference when changing a palette, not only the palette dictionary. Keep distinct light colors for semantic roles that must resolve to different dark colors.
