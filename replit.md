# BENNINI ETPI on Replit

## Run the app

The `Start application` workflow runs `npm run dev`. The server builds the Expo web app, connects to PostgreSQL, applies `server/schema.sql`, then serves the app and API on port 5000.

## Required Replit Secrets

- `SESSION_SECRET` — signs sessions and serial lookups.
- `NEON_DATABASE_URL` — PostgreSQL connection string used by the server. Keep it in Replit Secrets; do not commit it. (`DATABASE_URL` is accepted as a fallback.)
- `ADMIN_BOOTSTRAP_TOKEN` — a private, random value of at least 32 characters. It protects the one-time creation of the first administrator.

## First administrator

After the database and secrets are configured, open `/setup` directly. Enter the `ADMIN_BOOTSTRAP_TOKEN` and the administrator's six-digit sign-in serial. The app hashes and saves the serial in PostgreSQL and displays it once after setup. The setup endpoint refuses to create another administrator after one has been configured.

All other accounts are created by an administrator from the Users and Permissions dashboard. Their six-digit serial is displayed once at creation. Users sign in with that serial; email is not used for authentication.
