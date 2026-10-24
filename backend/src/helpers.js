// HELPERS: small tools used by many files (hashing, email, logging, validation, rate limits).
const crypto = require("crypto"),
  rateLimit = require("express-rate-limit");
const { E, PROD } = require("./env");

const hmac = (s) =>
  crypto.createHmac("sha256", E.JWT_SECRET).update(String(s)).digest("hex");

// Email via HTTPS API (Resend). Free hosts often block SMTP ports, so no SMTP is used.
async function mail(to, subject, text) {
  if (!E.RESEND_API_KEY) {
    if (PROD) throw new Error("RESEND_API_KEY missing");
    console.log("[DEV MAIL ONLY - not sent]", to, subject, "\n" + text);
    return;
  }
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    signal: AbortSignal.timeout(10000),
    headers: {
      Authorization: "Bearer " + E.RESEND_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: E.MAIL_FROM || "CTF Platform <onboarding@resend.dev>",
      to: [to],
      subject,
      text,
    }),
  });
  if (!r.ok) throw new Error("mail failed " + r.status);
}
const sha = (s) => crypto.createHash("sha256").update(String(s)).digest();
const eqHash = (s, hex) => {
  if (typeof hex !== "string") return false;
  const lhs = sha(s),
    rhs = Buffer.from(hex, "hex");
  if (lhs.length !== rhs.length) return false;
  try {
    return crypto.timingSafeEqual(lhs, rhs);
  } catch {
    return false;
  }
};
const safeJson = (v, fallback = []) => {
  if (typeof v !== "string" || !v.trim()) return fallback;
  try {
    return JSON.parse(v);
  } catch {
    return fallback;
  }
};

const log = (m, req, x = {}) =>
  console.warn(
    JSON.stringify({
      m,
      ip: req.ip,
      path: req.path,
      t: new Date().toISOString(),
      ...x,
    }),
  );
const bad = (res, error, code = 400) => res.status(code).json({ error });
const em = (v) =>
  typeof v === "string" &&
  v.length <= 254 &&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
    ? v.trim().toLowerCase()
    : null;
const PW = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{8,72}$/;
const MULT = Number(E.RATE_MULT) || 1; // set RATE_MULT=50 while testing to loosen all limits; remove for the real event
const lim = (max, win = 15 * 60 * 1000) =>
  rateLimit({
    windowMs: win,
    max: max * MULT,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests. Slow down." },
  });

const eqStr = (a, b) => crypto.timingSafeEqual(sha(a), sha(b));

module.exports = {
  hmac,
  mail,
  sha,
  eqHash,
  eqStr,
  safeJson,
  log,
  bad,
  em,
  PW,
  MULT,
  lim,
};
