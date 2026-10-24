# CTF Platform

A website for running a Capture-The-Flag event: teams sign up, solve challenges, submit flags and climb a leaderboard. Organizers get an admin panel (protected by password + authenticator-app code).

```
ctf-event-platform/
├── backend/     <- the server (Node + Express + PostgreSQL). Edit this to change HOW things work.
├── frontend/    <- the website people see (React). Edit this to change HOW things look.
├── docs/        <- EVENT_GUIDE.md: deploy, event-day tasks, backups, password recovery
└── sample_participants.csv   <- example file for the Admin > Import tab
```

## Run it in 4 steps

1. Make a free Postgres database (e.g. neon.tech) and copy its connection string.
2. `npm run build` (installs both folders and builds the website)
3. Copy `backend\.env.example` to `backend\.env` and fill it in (instructions are inside the file). In PowerShell, run `Copy-Item backend\.env.example backend\.env`.
   - `JWT_SECRET`: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
   - `ADMIN_PASSWORD_HASH`: `npm run hash -- 'YourStrongAdminPassword'`
4. `npm start` then open http://localhost:3000

Working on the code? Run `npm run dev` from the project folder. This starts the backend
on http://localhost:3001 and the frontend dev server (usually http://localhost:5173);
open the Vite address to check your changes. Both reload when you save.

## Keep code consistently formatted

Run `npm run format` from this project folder to format application source and documentation. Run `npm run format:check` to check formatting without changing files. Prettier settings are in `.prettierrc.json`.

## Find code by feature

- **Participant login, signup, password reset:** `backend/src/routes/auth.js`
- **Participant profile, leaderboard, challenges, flag submissions:** `backend/src/routes/participant.js`
- **Admin login and MFA:** `backend/src/routes/adminLogin.js`, `backend/src/routes/adminMfa.js`, `backend/src/totp.js`
- **Admin teams and participant imports:** `backend/src/routes/adminTeams.js`
- **Admin challenge management and uploads:** `backend/src/routes/adminChallenges.js`
- **Admin password recovery and settings:** `backend/src/routes/adminPassword.js`
- **Database tables and query helpers:** `backend/src/db.js`
- **Shared authentication and HTTP security:** `backend/src/middleware.js`
- **Page routing and shared UI:** `frontend/src/App.jsx`, `frontend/src/components/`
- **Participant dashboard:** `frontend/src/pages/Dashboard/`
- **Admin dashboard and tabs:** `frontend/src/pages/Admin/`
- **Colors, layout, and responsive rules:** `frontend/src/styles/` (loaded in order by `styles/index.js`)
- **Event title and background video:** `frontend/src/config.js`

> Never share `backend/.env` (zip, chat, GitHub). It holds your database password and secrets.

## "I want to change ..." cheat sheet

| I want to change...                                   | Edit this file                                                           |
| ----------------------------------------------------- | ------------------------------------------------------------------------ |
| Event name, background video                          | `frontend/src/config.js`                                                 |
| Colours and fonts                                     | top of `frontend/src/styles/01-base.css`                                 |
| Landing page text                                     | `frontend/src/pages/Landing.jsx`                                         |
| Login / sign-up / forgot-password form fields or text | `frontend/src/pages/Auth.jsx` (the `FORMS` list)                         |
| Participant dashboard (cards, leaderboard)            | `frontend/src/pages/Dashboard/`                                          |
| Admin panel tabs                                      | `frontend/src/pages/Admin/` (one file per tab)                           |
| Flag lockout timer (5 tries in 15s -> locked 2 min)   | `backend/src/settings.js`                                                |
| Challenge categories / difficulty levels              | `backend/src/settings.js`                                                |
| Allowed upload file types                             | `backend/src/settings.js`                                                |
| Password rules, rate limits, email sending            | `backend/src/helpers.js`                                                 |
| Participant login / signup logic                      | `backend/src/routes/auth.js`                                             |
| Flag checking and scoring                             | `backend/src/routes/participant.js`                                      |
| Admin login / MFA                                     | `backend/src/routes/adminLogin.js`, `adminMfa.js`, `backend/src/totp.js` |
| Admin team tools (import, remove, reset code)         | `backend/src/routes/adminTeams.js`                                       |
| Admin challenge tools                                 | `backend/src/routes/adminChallenges.js`                                  |
| Database tables                                       | `backend/src/db.js` (the `init` function)                                |

More detail: `backend/README.md` and `frontend/README.md`.
