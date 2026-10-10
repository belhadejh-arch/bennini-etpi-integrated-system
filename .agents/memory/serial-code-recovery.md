---
name: Serial-code recovery
description: Security and migration constraints for administrator access to member login serials.
---

Login serials must not be stored or returned as plaintext. Recoverable serials use authenticated encryption separate from the one-way login hash, and viewing or replacing them remains an administrator-only, audited action. Existing hash-only accounts cannot reveal their original serial; explicitly issue a replacement instead.

**Why:** Administrators need to help members who lose their code without exposing credentials in logs or weakening the existing sign-in checks. Encryption uses the stable session secret, so rotating that secret without reissuing/re-encrypting codes makes previously stored serials unrecoverable.

**How to apply:** Preserve the encryption and audit boundary in serial-management changes. Treat the session secret as stable across ordinary deploys, and guide older hash-only accounts through an explicit code reset.
