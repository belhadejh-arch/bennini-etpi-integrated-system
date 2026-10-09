---
name: Expo and Clerk dependency compatibility
description: Notes the React patch-level constraint between the Expo SDK and Clerk dependencies.
---

Keep the React and React DOM versions aligned with each other when using Expo SDK 54 and the current Clerk Expo/Express packages. Expo's dependency checker expects 19.1.0, while Clerk's shared package peer range requires 19.1.4 or later within the 19.1 line. Forcing 19.1.0 caused npm peer-resolution failures; 19.1.4 supports the current web export, though Expo's strict compatibility checker still reports the patch mismatch.

**Why:** Installing additional Clerk proxy dependencies caused npm to move React to 19.3.0, while Expo's SDK checker expected the 19.1 line. Attempts to force 19.1.0 conflicted with Clerk's peer range.

**How to apply:** Before changing these versions or preparing native builds, check both Clerk peer ranges and Expo's SDK compatibility. Prefer an Expo/Clerk version pair with a shared supported range rather than forcing npm peer resolution. When installing from semver ranges, inspect the resulting manifest and lockfile because npm may upgrade React and React Native beyond the project's known-compatible versions; restore or pin them before proceeding.
