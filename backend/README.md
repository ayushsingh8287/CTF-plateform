# Backend (the server)

Run from the project root: `npm start` (or `npm run dev:backend` while editing: it restarts on save).

## Where things are

```
backend/
├── server.js            START HERE. Only wires the pieces together (about 40 lines).
├── .env                 your secrets (never share or commit it)
├── .env.example         environment-variable template
└── src/
    ├── settings.js      numbers/lists organizers change: lockout timers, categories, default flag
    ├── env.js           reads .env and checks required values exist
    ├── db.js            database connection + table definitions + leaderboard query
    ├── helpers.js       small tools: password rules, rate limits, email, hashing, logging
    ├── middleware.js    security for every request + login guards (need / A / AS)
    ├── totp.js, mfa.js  authenticator-app (MFA) code checking. Rarely edited.
    └── routes/          every URL the website can call, grouped by topic
        ├── auth.js             /api/signup, /api/login, /api/logout, /api/forgot
        ├── participant.js      /api/me, /api/leaderboard, /api/challenges, flag submit, file download
        ├── adminLogin.js       /api/admin/login (+ authenticator step)
        ├── adminPassword.js    admin password change / forgot (emailed code)
        ├── adminMfa.js         set up / turn off the authenticator app
        ├── adminTeams.js       overview, remove teams, reset codes, CSV import
        ├── adminChallenges.js  create / edit / hide / delete challenges, uploads
        └── adminActivity.js    submission feed, teams.csv export
```

## How a route file looks

```js
module.exports = function register(app) {
  // GET /api/hello, only for logged-in participants:
  app.get("/api/hello", need("team"), async (req, res) => {
    res.json({ message: "hi " + req.u.email });
  });
};
```

- `need("team")` = participants only. `A` = admins only (MFA must be on). No guard = public.
- `q("select ... where id=$1", [id])` runs SQL and returns rows. Always pass values in the array (never glue them into the string: that causes SQL injection).
- `bad(res, "message", 400)` sends an error reply.

## Adding a new endpoint

1. Pick the matching file in `src/routes/` (or create `src/routes/myThing.js` using the template above).
2. If you created a new file, add one line to `server.js`: `require("./src/routes/myThing")(app);` (above the 404 line).
3. Restart (`npm run dev:backend` does it automatically) and test.

## Adding a database table or column

Edit the SQL inside `init()` in `src/db.js`. Use `create table if not exists ...` or `alter table ... add column if not exists ...`. It runs on every start and is safe to repeat.

## Admin-panel security rules (do not weaken)

- Every `/api/admin/*` route must use `A` (or `AS` for MFA-setup routes only). Never expose admin data without it.
- Keep `NODE_ENV=production` on the real server and do not set `RATE_MULT`.
- Rotating `JWT_SECRET` also breaks the stored MFA secret. See docs/EVENT_GUIDE.md ("Locked out").

## Local environment setup

Create `backend\.env` by copying `.env.example`, then enter your own PostgreSQL URL, JWT secret, admin email, and bcrypt password hash. `RESEND_API_KEY` is needed for admin OTP email; it may be blank during local development, when OTPs are printed in the backend console.

From the project root in PowerShell:

```powershell
Copy-Item backend\.env.example backend\.env
```

The `.env` file is ignored by Git. Do not share or commit it. Never reuse credentials pasted into a public or shared chat; rotate them and enter the replacements locally.
