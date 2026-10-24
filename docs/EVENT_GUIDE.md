# Event guide: running, deploying and operating the CTF

React (Vite) frontend, Node 20+ / Express backend, PostgreSQL. Challenge files are stored inside the database, so free hosts with temporary disks are fine.

## Run locally

1. Create a free Postgres database at neon.tech and copy its connection string.
2. `npm run build` once, then `cp backend/.env.example backend/.env` and fill it in.
   - `JWT_SECRET`: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
   - `ADMIN_PASSWORD_HASH`: `npm run hash -- 'YourStrongAdminPassword'`
3. `npm run build` (installs everything and builds the website), then `npm start`, open http://localhost:3000.
   For development, run `npm run dev:backend` in one terminal and `npm run dev:frontend` in another, then open the Vite URL (usually http://localhost:5173). If the backend is using a non-default port, set `API_PORT` before starting the client (PowerShell: `$env:API_PORT=3001; npm run dev:frontend`). The frontend hot-reloads on edits, and the backend automatically restarts when server files change. Tables are created automatically. A demo challenge uses the flag `P4R4DOXCTF{default_flag_here}`.

## Deploy (Vercel frontend + Render backend + PostgreSQL)

The frontend and backend run as separate services. The Vercel rewrite keeps API requests on the frontend domain, so the app's same-origin cookie and CSRF behavior continues to work.

1. Make sure this project is pushed to GitHub. `.env` is git-ignored; never add secrets to the repository.
2. Create a PostgreSQL database, for example on Neon, and copy its connection URL. Keep the URL private.
3. In Render, choose **New > Blueprint**, select this repository, and use the `render.yaml` at the repository root. Render creates the backend service. Set `DATABASE_URL`, `JWT_SECRET` (at least 32 random characters), `ADMIN_EMAIL`, and `ADMIN_PASSWORD_HASH` in the service environment. Generate the hash with `npm run hash -- 'YourStrongAdminPassword'` from the project root. Leave `NODE_ENV` set to `production`. `RESEND_API_KEY` is optional, but needed for admin recovery email.
4. After the Render service deploys, copy its `https://...onrender.com` URL. In `frontend/vercel.json`, replace `https://YOUR-RENDER-SERVICE.onrender.com` with that exact URL.
5. In Vercel, import the same GitHub repository and set **Root Directory** to `frontend`. Use `npm run build` as the build command and `dist` as the output directory. Deploy, then test the Vercel URL.
6. Before participants use the live event, open the admin Challenges page and disable or delete the default **Welcome Flag** demo challenge. Its demo flag is in the source code and should not be used for live scoring.

Redeploy the backend when its code or environment changes, and redeploy the Vercel frontend after changing `frontend/vercel.json`. Render free services may sleep when idle, so wake and test the site before the event. Challenge files are stored in PostgreSQL, not on the service disk.

## During the event (all in the Admin panel, no redeploy)

- Participants > Import: paste or upload the Google Form CSV (see `sample_participants.csv`). Re-import any time.
- Challenges: add, edit, enable/disable, hide, delete, change flags or files, and optionally provide an HTTP/HTTPS challenge URL for web-exploitation tasks. Participants see a link to open the site. Editing does not change existing scores; deleting a challenge removes points awarded for it while retaining submission history.
- Activity: per-member solve and point totals, including the names of problems solved, live solves and every flag submission with IP. Admins can delete a solve to revoke its points or delete individual flag-submission history entries. Overview: teams, ranks, CSV export.
- Forgotten password: Overview > Reset code, send the code privately to the participant.

## Backup / restore

Neon keeps point-in-time history and lets you create a branch from any moment. For your own copy: `pg_dump "$DATABASE_URL" > backup.sql`, restore with `psql "$DATABASE_URL" < backup.sql`. Also export the CSV from Admin before and after the event.

## Change the admin password after deploy (email code)

- Logged in: Admin > security > Send verification code > enter the 6-digit code from the admin email > new password.
- Forgot or leaked: Admin login > "Forgot admin password?". The code is sent only to `ADMIN_EMAIL`.
- A change signs out every admin session at once and replaces the password stored in the database. The `ADMIN_PASSWORD_HASH` env value is then ignored.
- New password: 12+ characters with upper, lower, number and symbol. Codes expire in 10 minutes, allow 5 tries, and can be requested once a minute.
- Email setup (free): create an account at resend.com using the SAME email as `ADMIN_EMAIL`, create an API key, and set `RESEND_API_KEY` locally and on Render. Without a verified domain, Resend only delivers to your own account email, which is exactly `your admin email` here. Free plan: 100 emails a day. The app submits the message immediately; final inbox delivery time is controlled by Resend and Gmail. A stalled Resend request now fails after 10 seconds so you can retry.
- Locally, with `RESEND_API_KEY` empty, the code is printed in the server console instead of emailed. In production a missing key shows "Email could not be sent".
- Locked out (no email access): in the Neon SQL editor run `delete from admin_cfg where key='pw_hash';` and the password from `ADMIN_PASSWORD_HASH` works again.

## Remove test participants (admin only)

Admin > overview: tick the teams you want gone and click "Remove selected". This deletes their approved emails, accounts, scores and submissions in one step. A small ✕ next to a member removes just that email and its account (team leaders can only be removed with the whole team). Both actions need the admin login and cannot be done by participants. Importing the CSV again would add them back.

## Admin multi-factor authentication (authenticator app)

- Admin > security > "Set up authenticator app": verify the one-time code sent to the admin email before the QR code is shown. Then scan it with Google Authenticator, Microsoft Authenticator or Authy, enter the 6-digit app code, and save the 8 one-time recovery codes shown once. This prevents someone who only knows the admin password from registering their own authenticator.
- After that, admin login is two steps: password, then the app code (or a recovery code). Each app code works only once. Five wrong codes cancel that login attempt. If you lose or delete the authenticator app, use a saved recovery code to log in, then go to Admin > security and reset the authenticator using another unused recovery code. Verify access to the admin email, enroll the app on the replacement device, and save the new recovery codes.
- MFA is required: until it is set up, the admin panel only shows the setup screen. "Reset authenticator" (security tab, needs a current code) is for a new phone and sends you straight back to setup. Lost phone and no recovery codes: in the Neon SQL editor run `delete from admin_cfg where key in ('mfa_on','mfa_secret','mfa_recovery');`.
- Keep your phone clock on automatic time, or codes will not match.

## Participant login protection

- Participant login uses parameterized SQL queries, which prevents SQL injection through the email field.
- Five wrong passwords for an account within 15 seconds lock that account for 2 minutes. The failed-attempt counter is updated atomically in PostgreSQL, so concurrent login attempts cannot bypass the threshold. A successful login resets the counter.
- Login requests are also limited to 30 per source IP per 15 minutes by default. `RATE_MULT` can loosen this limit for testing; leave it unset in production. The built-in rate limiter is in-memory and is not a substitute for a host/CDN/WAF against distributed or volumetric denial-of-service attacks.

## Flag submission protection

- Flags must be 1-200 printable ASCII characters. Anything else is rejected before any database work. All SQL uses bound parameters, and everything shown back to people is escaped by React.
- By default, a team that makes 5 flag attempts within 15 seconds is locked out of flag entry for 2 minutes (the whole team, all members). The page shows a countdown. Correct flags that were already solved do not count.
- **Change the timer:** open `backend/src/settings.js`, the boxed block near the top ("FLAG-ENTRY LOCKOUT TIMER"), and edit `FLAG_MAX_TRIES`, `FLAG_WINDOW_SEC` and `FLAG_LOCK_SEC`. Or, with no code change, set environment variables of the same names (on Render: Environment page, then it restarts). Values are in seconds.
- Input that looks like an attack (script tags, UNION SELECT and similar) is stored as plain text and written to the server log as "suspicious flag input".
