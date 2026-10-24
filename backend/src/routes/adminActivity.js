// ROUTES: admin activity feed (submissions, solves) and the teams.csv export.
const { q, board } = require("../db");
const { A } = require("../middleware");

module.exports = function register(app) {
  app.get("/api/admin/activity", A, async (req, res) => {
    res.json({
      submissions: await q(
        "select s.ts,a.team_name,c.title,s.flag,s.correct,s.points,s.ip from submissions s left join challenges c on c.id=s.challenge_id left join (select distinct team_key,team_name from approved) a on a.team_key=s.team_key order by s.ts desc limit 500",
      ),
      solves: await q(
        "select s.ts,a.team_name,c.title,s.points from solves s left join challenges c on c.id=s.challenge_id left join (select distinct team_key,team_name from approved) a on a.team_key=s.team_key order by s.ts desc limit 500",
      ),
    });
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
