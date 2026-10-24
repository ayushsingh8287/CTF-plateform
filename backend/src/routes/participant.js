// ROUTES: what a logged-in team sees. Profile, leaderboard, challenge list, flag submission, file downloads.
const rateLimit = require("express-rate-limit");
const { q, board } = require("../db");
const { bad, log, eqHash, lim, MULT } = require("../helpers");
const { need } = require("../middleware");
const { MAX_TRIES, WINDOW_SEC, LOCK_SEC } = require("../settings");

module.exports = function register(app) {
  /* ---------- participant ---------- */
  app.get("/api/me", need("team"), async (req, res) => {
    const [t] = await q(
      "select team_name,leader_name,leader_email,members from approved where email=$1",
      [req.u.email],
    );
    const b = await board(),
      i = b.findIndex((x) => x.team_key === req.u.team),
      entry = i >= 0 ? b[i] : null;
    const [{ n }] = await q(
      "select count(*)::int n from challenges where enabled and not hidden and not deleted",
    );
    const [{ s }] = await q(
      `select count(*)::int s from solves s join challenges c on c.id=s.challenge_id
       where s.team_key=$1 and c.enabled and not c.hidden and not c.deleted`,
      [req.u.team],
    );
    res.json({
      ...t,
      points: entry?.pts ?? 0,
      solved: s,
      total: n,
      rank: entry ? i + 1 : 0,
    });
  });
  app.get("/api/leaderboard", need("team"), async (req, res) => {
    const b = (await board()).map((x, i) => ({
      rank: i + 1,
      team: x.team_name,
      points: x.pts,
      mine: x.team_key === req.u.team,
    }));
    res.json(b.filter((x, i) => i < 20 || x.mine));
  });
  app.get("/api/challenges", need("team"), async (req, res) => {
    const cs = await q(
      `select c.id,c.title,c.category,c.difficulty,c.points,c.description,c.link,(s.team_key is not null) solved from challenges c left join solves s on s.challenge_id=c.id and s.team_key=$1 where c.enabled and not c.hidden and not c.deleted order by c.points,c.id`,
      [req.u.team],
    );
    const fs = cs.length
      ? await q(
          "select id,challenge_id,name,size from files where challenge_id=any($1)",
          [cs.map((c) => c.id)],
        )
      : [];
    cs.forEach((c) => (c.files = fs.filter((f) => f.challenge_id === c.id)));
    res.json(cs);
  });
  /* ---- flag submission: strict input rules + team lockout (5 attempts within 15 seconds => locked for 2 minutes) ---- */
  const FLAG_RE = /^[\x20-\x7E]{1,200}$/; // printable ASCII only; anything else is rejected before it touches the database
  const SUSPICIOUS =
    /(<\s*script|javascript:|\bon\w+\s*=|union\s+select|'\s*or\s+'?\d|;\s*drop\s|\/\*|--\s)/i;
  const ipBurst = rateLimit({
    windowMs: WINDOW_SEC * 1000,
    max: MAX_TRIES * 3 * MULT,
    message: { error: "Too many submissions from this network. Please wait." },
  });
  app.post("/api/challenges/:id/submit", need("team"), ipBurst, async (req, res) => {
    res.set("Cache-Control", "no-store");
    const id = Number(req.params.id),
      flag = req.body.flag;
    if (
      !Number.isInteger(id) ||
      id < 1 ||
      id > 2147483647 ||
      typeof flag !== "string" ||
      !FLAG_RE.test(flag.trim())
    )
      return bad(res, "Invalid flag format.");
    const [lk] = await q(
      "select extract(epoch from until-now())::int secs from flag_locks where team_key=$1 and until>now()",
      [req.u.team],
    );
    if (lk)
      return res.status(429).json({
        error: `Too many attempts. Flag entry is locked for ${lk.secs} more seconds.`,
        retry_after: lk.secs,
      });
    if (SUSPICIOUS.test(flag)) log("suspicious flag input", req, { team: req.u.team });
    const [c] = await q(
      "select * from challenges where id=$1 and enabled and not hidden and not deleted",
      [id],
    );
    if (!c) return bad(res, "Challenge not available.", 404);
    const already = {
      status: "already",
      message: "Your team has already solved this challenge.",
    };
    if (
      (
        await q("select 1 from solves where team_key=$1 and challenge_id=$2", [
          req.u.team,
          id,
        ])
      ).length
    )
      return res.json(already);
    const ok = eqHash(flag.trim(), c.flag_hash);
    let pts = 0;
    if (ok) {
      const r = await q(
        "insert into solves(team_key,challenge_id,points,by_email) values($1,$2,$3,$4) on conflict do nothing returning 1",
        [req.u.team, id, c.points, req.u.email],
      );
      if (!r.length) return res.json(already);
      pts = c.points;
    }
    await q(
      "insert into submissions(team_key,challenge_id,flag,correct,points,ip,by_email) values($1,$2,$3,$4,$5,$6,$7)",
      [req.u.team, id, flag.trim(), ok, pts, req.ip, req.u.email],
    );
    const [{ n }] = await q(
      "select count(*)::int n from submissions where team_key=$1 and ts>now()-make_interval(secs=>$2)",
      [req.u.team, WINDOW_SEC],
    );
    let locked = 0;
    if (n >= MAX_TRIES) {
      await q(
        "insert into flag_locks(team_key,until) values($1,now()+make_interval(secs=>$2)) on conflict(team_key) do update set until=now()+make_interval(secs=>$2)",
        [req.u.team, LOCK_SEC],
      );
      locked = LOCK_SEC;
      log("flag lockout", req, { team: req.u.team });
    }
    res.json({
      ...(ok
        ? {
            status: "correct",
            message: "Correct flag! Points added to your team.",
          }
        : { status: "wrong", message: "Incorrect flag. Try again." }),
      locked,
    });
  });
  app.get("/api/files/:id", need("team"), lim(60, 60000), async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return bad(res, "Invalid input.");
    const [f] = await q(
      "select f.name,f.data from files f join challenges c on c.id=f.challenge_id where f.id=$1 and c.enabled and not c.hidden and not c.deleted",
      [id],
    );
    if (!f) return bad(res, "Not found.", 404);
    res.set({
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${f.name}"`,
      "X-Content-Type-Options": "nosniff",
    });
    res.send(f.data);
  });
};
