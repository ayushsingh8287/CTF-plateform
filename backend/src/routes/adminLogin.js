// ROUTES: admin login (password, then authenticator code).
const crypto = require("crypto"),
  bcrypt = require("bcryptjs"),
  jwt = require("jsonwebtoken");
const { E } = require("../env");
const { cfg } = require("../db");
const { bad, log, lim } = require("../helpers");
const { setTok } = require("../middleware");
const { checkTotp, useRecovery } = require("../totp");

// password-OK tickets waiting for the authenticator code -> failed code tries (max 5 each)
const tickets = new Map();

module.exports = function register(app) {
  /* ---------- admin ---------- */
  app.post("/api/admin/login", lim(8), async (req, res) => {
    const { email, password } = req.body,
      s = (v) => (typeof v === "string" ? v : "");
    const good = await bcrypt.compare(
      s(password),
      (await cfg("pw_hash")) || E.ADMIN_PASSWORD_HASH,
    );
    if (!(good && s(email).toLowerCase() === E.ADMIN_EMAIL.toLowerCase())) {
      log("admin login failed", req);
      return bad(res, "Invalid credentials.", 401);
    }
    if ((await cfg("mfa_on")) === "1") {
      // password OK, second factor still required: no session yet
      const jti = crypto.randomUUID();
      tickets.set(jti, 0);
      setTimeout(() => tickets.delete(jti), 5 * 60000).unref();
      return res.json({
        mfa: true,
        ticket: jwt.sign({ role: "mfa", jti }, E.JWT_SECRET, {
          expiresIn: "5m",
        }),
      });
    }
    setTok(res, {
      role: "admin",
      email: "admin",
      v: Number((await cfg("tokver")) || 0),
    });
    res.json({ ok: true, mfa_setup: true });
  });
  app.post("/api/admin/login/mfa", lim(15), async (req, res) => {
    const gone = () =>
      res.status(401).json({
        error: "Session expired. Please enter your password again.",
        restart: true,
      });
    let t;
    try {
      t = jwt.verify(String(req.body.ticket || ""), E.JWT_SECRET);
      if (t.role !== "mfa") throw 0;
    } catch {
      return gone();
    }
    const n = tickets.get(t.jti);
    if (n === undefined || n >= 5) {
      tickets.delete(t.jti);
      return gone();
    }
    tickets.set(t.jti, n + 1);
    const code =
      typeof req.body.code === "string" ? req.body.code.trim().slice(0, 20) : "";
    if (!(await checkTotp("mfa_secret", code)) && !(await useRecovery(code))) {
      log("admin mfa failed", req);
      return bad(
        res,
        "Invalid or already-used code. Wait for a new code in your app and try again (and check that your phone clock is set to automatic).",
        401,
      );
    }
    tickets.delete(t.jti);
    setTok(res, {
      role: "admin",
      email: "admin",
      v: Number((await cfg("tokver")) || 0),
    });
    res.json({ ok: true });
  });
};
