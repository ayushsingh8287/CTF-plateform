// ROUTES: admin activity feed (submissions, solves) and the teams.csv export.
const { q, board } = require("../db");
const { bad, log } = require("../helpers");
const { A } = require("../middleware");

module.exports = function register(app) {
  app.get("/api/admin/activity", A, async (req, res) => {
    res.json({
      submissions: await q(
        "select s.id,s.ts,a.team_name,c.title,s.flag,s.correct,s.points,s.ip from submissions s left join challenges c on c.id=s.challenge_id left join (select distinct team_key,team_name from approved) a on a.team_key=s.team_key order by s.ts desc limit 500",
      ),
      solves: await q(
        `select s.ts,s.team_key,s.challenge_id,s.by_email,a.team_name,
          coalesce((select m.value->>'name' from jsonb_array_elements(a.members) m(value)
            where lower(m.value->>'email')=lower(s.by_email) limit 1),s.by_email) member_name,
          c.title,s.points
         from solves s
         left join challenges c on c.id=s.challenge_id
         left join (select distinct on(team_key) team_key,team_name,members from approved order by team_key) a
           on a.team_key=s.team_key
         order by s.ts desc limit 500`,
      ),
      members: await q(
        `select a.team_key,a.team_name,a.email,
          coalesce((select m.value->>'name' from jsonb_array_elements(a.members) m(value)
            where lower(m.value->>'email')=lower(a.email) limit 1),
            case when a.email=a.leader_email then a.leader_name else a.email end) member_name,
          count(s.challenge_id)::int solves,
          coalesce(sum(s.points),0)::int points,
          coalesce(string_agg(distinct c.title, ', ' order by c.title)
            filter (where c.title is not null), '') problems
         from (select distinct on(team_key,email) team_key,team_name,email,leader_email,leader_name,members
           from approved order by team_key,email) a
         left join solves s on s.team_key=a.team_key and lower(s.by_email)=lower(a.email)
         left join challenges c on c.id=s.challenge_id
         group by a.team_key,a.team_name,a.email,a.leader_email,a.leader_name,a.members
         order by a.team_name,member_name`,
      ),
    });
  });
  app.delete("/api/admin/activity/solves", A, async (req, res) => {
    const { team_key: teamKey, challenge_id: challengeId } = req.body;
    const id = Number(challengeId);
    if (
      typeof teamKey !== "string" ||
      !teamKey.trim() ||
      teamKey.length > 200 ||
      !Number.isSafeInteger(id) ||
      id < 1 ||
      id > 2147483647
    )
      return bad(res, "Invalid solve.");
    const removed = await q(
      "delete from solves where team_key=$1 and challenge_id=$2 returning team_key,challenge_id,points",
      [teamKey, id],
    );
    if (!removed.length) return bad(res, "Solve not found.", 404);
    log("admin removed solve and revoked awarded points", req, {
      team: teamKey,
      challenge: id,
      points: removed[0].points,
    });
    res.json({ ok: true, pointsRemoved: removed[0].points });
  });
  app.delete("/api/admin/activity/submissions/:id", A, async (req, res) => {
    const id = Number(req.params.id);
    if (
      !/^\d+$/.test(req.params.id) ||
      !Number.isSafeInteger(id) ||
      id < 1 ||
      id > 2147483647
    )
      return bad(res, "Invalid submission.");
    const removed = await q(
      "delete from submissions where id=$1 returning id,team_key,challenge_id,correct",
      [id],
    );
    if (!removed.length) return bad(res, "Submission not found.", 404);
    log("admin deleted flag submission history", req, {
      submission: id,
      team: removed[0].team_key,
      challenge: removed[0].challenge_id,
      correct: removed[0].correct,
    });
    res.json({ ok: true });
  });
  const cell = (v) => {
    v = String(v ?? "");
    if (/^[=+\-@\t\r]/.test(v)) v = "'" + v;
    return '"' + v.replace(/"/g, '""') + '"';
  };
  app.get("/api/admin/export.csv", A, async (req, res) => {
    const b = await board(),
      rows = await q("select distinct on(team_key) * from approved order by team_key");
    const out = [
      ["Rank", "Team", "Leader", "Leader email", "Members", "Size", "Points"],
    ];
    b.forEach((x, i) => {
      const t = rows.find((r) => r.team_key === x.team_key);
      out.push([
        i + 1,
        x.team_name,
        t.leader_name,
        t.leader_email,
        t.members.map((m) => `${m.name} <${m.email}>`).join("; "),
        t.size,
        x.pts,
      ]);
    });
    res
      .set({
        "Content-Type": "text/csv",
        "Content-Disposition": 'attachment; filename="teams.csv"',
      })
      .send(out.map((r) => r.map(cell).join(",")).join("\n"));
  });
};
