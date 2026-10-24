// ROUTES: participant accounts. Sign up, log in, log out, forgot password (organizer reset code).
const bcrypt = require("bcryptjs");
const { q } = require("../db");
const { bad, em, PW, log, eqHash, lim } = require("../helpers");
const { PROD } = require("../env");
const { setTok } = require("../middleware");
const { LOGIN_MAX_TRIES, LOGIN_WINDOW_SEC, LOGIN_LOCK_SEC } = require("../settings");

module.exports = function register(app) {
  /* ---------- auth ---------- */
  app.post("/api/signup", lim(10), async (req, res) => {
    const email = em(req.body.email),
      { password, confirm } = req.body;
    if (!email || typeof password !== "string") return bad(res, "Invalid input.");
    if (!(await q("select 1 from approved where email=$1", [email])).length)
      return bad(
        res,
        "This email is not registered for the CTF. Please register through the official Google Form.",
        403,
      );
    if (!PW.test(password))
      return bad(
        res,
        "Password needs 8+ characters with uppercase, lowercase, a number and a special character.",
      );
    if (password !== confirm) return bad(res, "Passwords do not match.");
    const r = await q(
      "insert into users(email,hash) values($1,$2) on conflict do nothing returning email",
      [email, await bcrypt.hash(password, 12)],
    );
    if (!r.length)
      return bad(res, "An account already exists with this email. Please login.", 409);
    await q("insert into pw_log(email,kind) values($1,'created')", [email]);
    res.json({ ok: true });
  });

  const loginLocked = (res, until) => {
    const retryAfter = Math.max(
      1,
      Math.ceil((new Date(until).getTime() - Date.now()) / 1000),
    );
    res.set("Retry-After", String(retryAfter));
    return res.status(429).json({
      error: `Too many failed attempts. Try again in ${retryAfter} seconds.`,
      retry_after: retryAfter,
    });
  };
  app.post("/api/login", lim(30), async (req, res) => {
    const email = em(req.body.email),
      pw = req.body.password;
    const [u] =
      email && typeof pw === "string"
        ? await q(
            "select hash,locked_until,session_version from users where email=$1",
            [email],
          )
        : [];
    if (u?.locked_until && u.locked_until > new Date())
      return loginLocked(res, u.locked_until);
    if (!u || !(await bcrypt.compare(pw, u.hash))) {
      if (u) {
        const [attempt] = await q(
          `update users set
    failed=case when locked_until>now() then failed
      when failed_since is null or failed_since<=now()-($2*interval '1 second') then 1
      when failed+1>=$3 then 0 else failed+1 end,
    failed_since=case when locked_until>now() then failed_since
      when failed_since is null or failed_since<=now()-($2*interval '1 second') then now()
      else failed_since end,
    locked_until=case when locked_until>now() then locked_until
      when failed_since is not null and failed_since>now()-($2*interval '1 second') and failed+1>=$3
        then now()+($4*interval '1 second') else null end
    where email=$1 returning locked_until`,
          [email, LOGIN_WINDOW_SEC, LOGIN_MAX_TRIES, LOGIN_LOCK_SEC],
        );
        if (attempt?.locked_until && attempt.locked_until > new Date())
          return loginLocked(res, attempt.locked_until);
      }
      log("failed login", req, { email });
      return bad(res, "Invalid email or password.", 401);
    }
    const [session] = await q(
      "update users set failed=0,failed_since=null,locked_until=null where email=$1 and (locked_until is null or locked_until<=now()) returning email",
      [email],
    );
    if (!session) {
      const [current] = await q("select locked_until from users where email=$1", [
        email,
      ]);
      if (current?.locked_until && current.locked_until > new Date())
        return loginLocked(res, current.locked_until);
      return bad(res, "Invalid email or password.", 401);
    }
    const [a] = await q("select team_key from approved where email=$1", [email]);
    if (!a) return bad(res, "Invalid email or password.", 401);
    setTok(res, {
      role: "team",
      email,
      team: a.team_key,
      v: u.session_version,
    });
    res.json({ ok: true });
  });

  app.post("/api/logout", (req, res) => {
    res.clearCookie("tok", {
      httpOnly: true,
      secure: PROD,
      sameSite: "strict",
    });
    res.json({ ok: true });
  });

  // Forgot password: needs a one-time code the organizer generates (Admin > Teams). Email alone must never be enough to reset a password.
  app.post("/api/forgot", lim(8), async (req, res) => {
    const email = em(req.body.email),
      { code, password } = req.body;
    const [u] = email ? await q("select * from users where email=$1", [email]) : [];
    if (
      !u ||
      !u.reset_hash ||
      u.reset_expires < new Date() ||
      typeof code !== "string" ||
      !eqHash(code.trim().toUpperCase(), u.reset_hash)
    ) {
      log("bad reset", req, { email });
      return bad(
        res,
        "Invalid or expired reset code. Ask the organizer for a new one.",
        400,
      );
    }
    if (typeof password !== "string" || !PW.test(password))
      return bad(
        res,
        "Password needs 8+ characters with uppercase, lowercase, a number and a special character.",
      );
    const updated = await q(
      "update users set hash=$3,password_updated=now(),reset_hash=null,reset_expires=null,failed=0,failed_since=null,locked_until=null,session_version=session_version+1 where email=$1 and reset_hash=$2 and reset_expires>now() returning email",
      [email, u.reset_hash, await bcrypt.hash(password, 12)],
    );
    if (!updated.length)
      return bad(
        res,
        "Invalid or expired reset code. Ask the organizer for a new one.",
        400,
      );
    await q("insert into pw_log(email,kind) values($1,'reset')", [email]);
    res.json({
      ok: true,
      message:
        "Password updated successfully. You can now login with your new password.",
    });
  });
};
