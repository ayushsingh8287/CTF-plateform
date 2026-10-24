// ROUTES: admin password change / forgot-password, protected by a code emailed to the admin.
const crypto = require("crypto"),
  bcrypt = require("bcryptjs");
const { E, PROD } = require("../env");
const { cfg, setCfg } = require("../db");
const { hmac, mail, bad, em, log, lim, PW } = require("../helpers");
const { need } = require("../middleware");
const { consumeOtp } = require("../otp");

module.exports = function register(app) {
  /* ---- admin password change with email OTP ---- */
  const adminEmail = () => E.ADMIN_EMAIL.trim().toLowerCase();
  async function sendOtp(req, res) {
    if (Date.now() - Number((await cfg("otp_sent")) || 0) < 60000)
      return bad(res, "Please wait a minute before requesting another code.", 429);
    const otp = String(crypto.randomInt(100000, 1000000));
    await setCfg("otp_hash", hmac(otp));
    await setCfg("otp_exp", Date.now() + 600000);
    await setCfg("otp_tries", 0);
    await setCfg("otp_sent", Date.now());
    try {
      await mail(
        E.ADMIN_EMAIL,
        "Your admin verification code",
        `Your admin verification code is ${otp}\nIt expires in 10 minutes.\nRequested from IP ${req.ip}.\nIf this was not you, ignore this email and change your admin password.`,
      );
    } catch (e) {
      console.error(e.message);
      return bad(res, "Email could not be sent. Check the email settings.", 503);
    }
    res.json({
      ok: true,
      message: "A 6-digit code was sent to the admin email. It expires in 10 minutes.",
    });
  }
  const strongAdmin = (p) =>
    typeof p === "string" && p.length >= 12 && p.length <= 72 && PW.test(p);
  const WEAK =
    "Admin password needs 12+ characters with uppercase, lowercase, a number and a special character.";
  async function applyNew(res, password) {
    await setCfg("pw_hash", await bcrypt.hash(password, 12));
    await setCfg("tokver", Number((await cfg("tokver")) || 0) + 1);
    await setCfg("otp_hash", "");
    res.clearCookie("tok", {
      httpOnly: true,
      secure: PROD,
      sameSite: "strict",
    });
    res.json({
      ok: true,
      message:
        "Admin password changed. All admin sessions were signed out. Please login again.",
    });
  }
  // not logged in (forgot password): the code goes only to the admin email, and the reply never reveals if an email matched
  app.post("/api/admin/forgot/request", lim(5), async (req, res) => {
    if (em(req.body.email) === adminEmail()) return sendOtp(req, res);
    log("admin reset requested for unknown email", req);
    res.json({
      ok: true,
      message: "If that is the admin email, a code was sent.",
    });
  });
  app.post("/api/admin/forgot/reset", lim(8), async (req, res) => {
    const { email, otp, password } = req.body;
    if (em(email) !== adminEmail()) {
      log("bad admin otp", req);
      return bad(res, "Invalid or expired code.", 400);
    }
    if (!strongAdmin(password)) return bad(res, WEAK);
    if (!(await consumeOtp("otp", otp))) {
      log("bad admin otp", req);
      return bad(res, "Invalid or expired code.", 400);
    }
    await applyNew(res, password);
  });
  // logged in (Admin > security)
  app.post("/api/admin/security/otp", need("admin"), lim(5), (req, res) =>
    sendOtp(req, res),
  );
  app.post("/api/admin/security/change", need("admin"), lim(8), async (req, res) => {
    if (!strongAdmin(req.body.password)) return bad(res, WEAK);
    if (!(await consumeOtp("otp", req.body.otp))) {
      log("bad admin otp", req);
      return bad(res, "Invalid or expired code.", 400);
    }
    await applyNew(res, req.body.password);
  });
};
