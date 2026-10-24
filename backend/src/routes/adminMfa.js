// ROUTES: admin multi-factor authentication (authenticator app) setup and switch-off.
const crypto = require("crypto"),
  QRCode = require("qrcode");
const { E } = require("../env");
const { cfg, setCfg } = require("../db");
const { hmac, mail, bad, lim, safeJson } = require("../helpers");
const { A, AS } = require("../middleware");
const { checkTotp, useRecovery, b32enc, encS } = require("../totp");
const { consumeOtp } = require("../otp");

const enrollTickets = new Map(); // email-verified tickets allowed to start authenticator setup

module.exports = function register(app) {
  app.get("/api/admin/mfa/status", AS, async (req, res) => {
    const recovery = safeJson(await cfg("mfa_recovery"), []);
    res.json({
      on: (await cfg("mfa_on")) === "1",
      recovery: Array.isArray(recovery) ? recovery.length : 0,
    });
  });
  app.post("/api/admin/mfa/authorize", AS, lim(5), async (req, res) => {
    if ((await cfg("mfa_on")) === "1") return bad(res, "MFA is already on.");
    if (Date.now() - Number((await cfg("mfa_enroll_sent")) || 0) < 60000)
      return bad(res, "Please wait a minute before requesting another code.", 429);
    const otp = String(crypto.randomInt(100000, 1000000));
    await setCfg("mfa_enroll_hash", hmac(otp));
    await setCfg("mfa_enroll_exp", Date.now() + 600000);
    await setCfg("mfa_enroll_tries", 0);
    await setCfg("mfa_enroll_sent", Date.now());
    try {
      await mail(
        E.ADMIN_EMAIL,
        "Authorize admin authenticator setup",
        `Your code to set up admin multi-factor authentication is ${otp}\nIt expires in 10 minutes.\nIf you did not request this, ignore this email and secure your admin password.`,
      );
    } catch (e) {
      await setCfg("mfa_enroll_hash", "");
      console.error(e.message);
      return bad(res, "Email could not be sent. Check the email settings.", 503);
    }
    res.json({
      ok: true,
      message:
        "A verification code was sent to the admin email. Enter it to authorize authenticator setup.",
    });
  });
  app.post("/api/admin/mfa/authorize/verify", AS, lim(10), async (req, res) => {
    if (!(await consumeOtp("mfa_enroll", req.body.code)))
      return bad(res, "Invalid or expired verification code.", 400);
    const ticket = crypto.randomBytes(32).toString("hex");
    enrollTickets.set(ticket, false);
    setTimeout(() => enrollTickets.delete(ticket), 5 * 60000).unref();
    res.json({ ok: true, ticket });
  });
  app.post("/api/admin/mfa/setup", AS, lim(10), async (req, res) => {
    if ((await cfg("mfa_on")) === "1") return bad(res, "MFA is already on.");
    const ticket = typeof req.body.ticket === "string" ? req.body.ticket : "";
    if (!enrollTickets.has(ticket) || enrollTickets.get(ticket))
      return bad(
        res,
        "Verify the code sent to the admin email before setting up MFA.",
        403,
      );
    enrollTickets.set(ticket, true);
    const sec = b32enc(crypto.randomBytes(20));
    await setCfg("mfa_pending", encS(sec));
    const url = `otpauth://totp/CTF%20Admin:${encodeURIComponent(E.ADMIN_EMAIL)}?secret=${sec}&issuer=CTF%20Admin`;
    res.json({
      secret: sec,
      qr: await QRCode.toDataURL(url, { margin: 1, width: 220 }),
    });
  });
  app.post("/api/admin/mfa/enable", AS, lim(10), async (req, res) => {
    const ticket = typeof req.body.ticket === "string" ? req.body.ticket : "";
    if (!enrollTickets.has(ticket) || !enrollTickets.get(ticket))
      return bad(
        res,
        "Verify the code sent to the admin email before enabling MFA.",
        403,
      );
    if (!(await checkTotp("mfa_pending", req.body.code)))
      return bad(
        res,
        "Invalid code. Check that your phone clock is automatic, then try again.",
      );
    await setCfg("mfa_secret", await cfg("mfa_pending"));
    await setCfg("mfa_pending", "");
    await setCfg("mfa_on", "1");
    const codes = Array.from({ length: 8 }, () => {
      const h = crypto.randomBytes(5).toString("hex");
      return h.slice(0, 5) + "-" + h.slice(5);
    });
    await setCfg(
      "mfa_recovery",
      JSON.stringify(codes.map((c) => hmac("rc:" + c.replace("-", "")))),
    );
    enrollTickets.delete(ticket);
    res.json({ ok: true, codes });
  });
  app.post("/api/admin/mfa/disable", A, lim(10), async (req, res) => {
    if (
      !(await checkTotp("mfa_secret", req.body.code)) &&
      !(await useRecovery(req.body.code))
    )
      return bad(res, "Invalid app or recovery code.");
    for (const k of ["mfa_on", "mfa_secret", "mfa_recovery"]) await setCfg(k, "");
    res.json({ ok: true });
  });
};
