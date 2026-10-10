# BENNINI ETPI on Replit

## Run the full app locally or on Replit

The `Start application` workflow runs `npm run dev`. The server builds the Expo web app, connects to PostgreSQL, applies `server/schema.sql`, then serves the app and API on port 5000.

Set these environment variables for the local/Replit server:

- `SESSION_SECRET` — signs sessions and serial lookups.
- `NEON_DATABASE_URL` or `DATABASE_URL` — PostgreSQL connection string.
- `ADMIN_BOOTSTRAP_TOKEN` — private, random value of at least 32 characters for one-time administrator setup.

## First administrator

After the database and environment variables are configured, open `/setup` directly. Enter the `ADMIN_BOOTSTRAP_TOKEN` and the administrator's six-digit sign-in serial. The app hashes and saves the serial in PostgreSQL and displays it once after setup. The setup endpoint refuses to create another administrator after one has been configured.

All other accounts are created by an administrator from the Users and Permissions dashboard. Their six-digit serial is displayed once at creation. Users sign in with that serial; email is not used for authentication.

## Split production hosting (Render API + Vercel web app)

- `render.yaml` deploys only the Express API. It runs `npm ci && npm run typecheck` then `npm start`, uses `/api/health` for health checks, and disables serving the web build.
- `vercel.json` builds the Expo web export into `dist` and rewrites app routes to `index.html`.
- Configure `DATABASE_URL`, `SESSION_SECRET`, and `ADMIN_BOOTSTRAP_TOKEN` on Render. Use a persistent PostgreSQL service; the app applies `server/schema.sql` on startup. Render generates `SESSION_SECRET`; set `ADMIN_BOOTSTRAP_TOKEN` to a private random value and keep it available for the one-time `/setup` flow.
- `CORS_ORIGINS` is optional until the Vercel frontend exists. With it unset, the API can run and same-origin or non-browser requests work, while browsers cannot read cross-origin API responses. Once Vercel is deployed, set `CORS_ORIGINS` to the exact site origin, such as `https://your-project.vercel.app` (no path or trailing slash). Add other exact origins as comma-separated values if needed.
- Vercel builds default to the confirmed Render API origin `https://bennini-etpi.onrender.com`. Set `EXPO_PUBLIC_API_URL` in Vercel only if the API origin changes; use its HTTPS origin with no trailing slash. This is a public URL, not a secret.
- Do not put database URLs, session secrets, or the bootstrap token in Vercel or in committed files.
