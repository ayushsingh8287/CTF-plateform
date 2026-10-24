// MIDDLEWARE: security rules applied to every request, plus the login-cookie helpers.
//   applySecurity(app) : helmet/CSP, CSRF protection, serves the built frontend
//   setTok(res, data)  : gives the browser a login cookie (JWT, 30 minutes)
//   need("team")       : route guard -> only logged-in participants
//   A                  : route guard -> only logged-in admins WITH MFA switched on
//   AS                 : route guard -> admins, even before MFA is set up (MFA setup routes only)
const path = require("path");
const express = require("express"),
  helmet = require("helmet"),
  jwt = require("jsonwebtoken"),
  cp = require("cookie-parser"),
  crypto = require("crypto");
const { E, PROD } = require("./env");
const { cfg, q } = require("./db");
const { log, bad } = require("./helpers");

// Where the compiled frontend lives (made by `npm run build`).
const FRONTEND_DIST = path.join(__dirname, "..", "..", "frontend", "dist");

function applySecurity(app) {
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"],
          styleSrcAttr: ["'unsafe-inline'"],
          imgSrc: ["'self'", "data:"],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          upgradeInsecureRequests: PROD ? [] : null,
        },
      },
      frameguard: { action: "deny" },
      referrerPolicy: { policy: "strict-origin-when-cross-origin" },
      hsts: PROD,
    }),
  );
  app.use((req, res, next) => {
    res.set("Permissions-Policy", "camera=(),microphone=(),geolocation=(),payment=()");
    next();
  });
  app.use(cp(), express.json({ limit: "200kb" }));
  app.use((req, res, next) => {
    req.body ??= {};
    if (!req.cookies.csrf) {
      const t = crypto.randomBytes(24).toString("hex");
      req.cookies.csrf = t;
      res.cookie("csrf", t, { secure: PROD, sameSite: "strict" });
    }
    if (
      !["GET", "HEAD"].includes(req.method) &&
      req.get("x-csrf-token") !== req.cookies.csrf
    )
      return bad(res, "Bad CSRF token", 403);
    next();
  });
  app.use(express.static(FRONTEND_DIST));
}

const setTok = (res, o) =>
  res.cookie("tok", jwt.sign(o, E.JWT_SECRET, { expiresIn: "30m" }), {
    httpOnly: true,
    secure: PROD,
    sameSite: "strict",
    maxAge: 30 * 60 * 1000,
  });
const need = (role, allowSetup) => async (req, res, next) => {
  let t;
  try {
    t = jwt.verify(req.cookies.tok || "", E.JWT_SECRET);
  } catch {
    if (role === "admin") log("unauthorized admin access", req);
    return bad(res, "Unauthorized", 401);
  }
  if (t.role !== role) {
    if (role === "admin") log("unauthorized admin access", req);
    return bad(res, "Unauthorized", 401);
  }
  if (role === "admin" && (t.v || 0) !== Number((await cfg("tokver")) || 0)) {
    log("unauthorized admin access", req);
    return bad(res, "Unauthorized", 401);
  }
  if (role === "team") {
    const [account] = await q(
      "select u.session_version from users u join approved a using(email) where u.email=$1 and a.team_key=$2",
      [t.email, t.team],
    );
    if (!account || Number(t.v || 0) !== account.session_version)
      return bad(res, "Unauthorized", 401);
  }
  if (role === "admin" && !allowSetup && (await cfg("mfa_on")) !== "1")
    return res.status(403).json({
      error: "Set up multi-factor authentication first.",
      mfa_required: true,
    }); // MFA is mandatory for the admin panel
  if (t.exp * 1000 - Date.now() < 10 * 60 * 1000)
    setTok(res, { role: t.role, email: t.email, team: t.team, v: t.v }); // sliding refresh
  req.u = t;
  next();
};

const A = need("admin"),
  AS = need("admin", true); // AS = reachable before MFA is set up (only the MFA setup routes use it)

module.exports = { applySecurity, setTok, need, A, AS };
