# Frontend (the website)

React + Vite. Run `npm run dev:frontend` from the project root while editing (reloads on save, talks to the backend on port 3000). `npm run build` makes the final files in `frontend/dist`, which the backend serves.

## Where things are

```
frontend/
├── index.html           page title + description (shown in the browser tab)
├── public/videos/       optional background video (see the README inside)
└── src/
    ├── main.jsx         starts the app (rarely edited)
    ├── App.jsx          the "router": URL after # decides which page is shown
    ├── config.js        EVENT NAME and background video paths   <- edit first
    ├── lib/api.js       talks to the backend (api(), go(), logout(), fmt(), kb())
    ├── components/      reusable pieces
    │   ├── Shell.jsx          top bar + page frame (also exports LogoutBtn)
    │   ├── Hud.jsx            decorative side panel next to forms
    │   ├── PasswordField.jsx  password box with SHOW/HIDE
    │   ├── Mfa.jsx            authenticator-app setup screen
    │   ├── OtpReset.jsx       "enter emailed code + new password" form
    │   └── CityBackdrop.jsx   animated neon-city background
    ├── pages/           one file (or folder) per screen
    │   ├── Landing.jsx        public home page             (#)
    │   ├── Auth.jsx           login / signup / forgot      (#login #signup #forgot)
    │   ├── AdminLogin.jsx     admin login                  (#admin-login)
    │   ├── AdminForgot.jsx    admin password recovery      (#admin-forgot)
    │   ├── Dashboard/         participant dashboard        (#dash)
    │   └── Admin/             admin panel, one file per tab (#admin)
    └── styles/          CSS, split by topic and loaded in numbered order (see styles/index.js)
```

## Common jobs

- **Rename the event:** `src/config.js`.
- **Change colours:** variables at the top of `styles/01-base.css` (`--c`, `--p`, `--g` ...).
- **Edit a login form:** the `FORMS` list in `pages/Auth.jsx` (each row = `[field name, label, input type]`).
- **Add a page:** create `pages/MyPage.jsx` (copy a small page such as `AdminForgot.jsx`), import it in `App.jsx`, and add a line there to show it for `#mypage`.
- **Add an admin tab:** create `pages/Admin/MyTab.jsx`, then import it in `pages/Admin/index.jsx` and add it to `TABS`.
- **Call the backend:** `const r = await api("/api/me")` then use `r.ok` and `r.d` (the JSON reply). Use `api(url, { method: "POST", json: {...} })` to send data. CSRF is handled for you.

## Rules of thumb

- Run `npm run build` after changes, before deploying (the server only serves the built `dist`).
- Do not put secrets in the frontend. Anyone can read it in the browser.
- Hiding something in the UI is not security. The backend must also refuse it.

## Deploy on Vercel

Set the Vercel project Root Directory to `frontend`, with `npm run build` as the build command and `dist` as the output directory. The `vercel.json` rewrite forwards `/api/*` to the Render backend; replace its placeholder host with the deployed backend URL before deploying.
