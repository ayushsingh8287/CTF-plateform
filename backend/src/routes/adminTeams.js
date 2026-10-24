// ROUTES: admin team management. Overview, remove teams/participants, reset codes, CSV import.
const crypto = require("crypto");
const { db, q, board } = require("../db");
const { bad, em, log, sha } = require("../helpers");
const { A } = require("../middleware");

module.exports = function register(app) {
  app.get("/api/admin/overview", A, async (req, res) => {
    const teams = await q(
      "select distinct on(team_key) team_key,team_name,leader_name,leader_email,members,size,created from approved order by team_key",
    );
    const accounts = await q(
      "select u.email,a.team_key,u.created,u.password_updated from users u join approved a using(email)",
    );
    const hist = accounts.length
      ? await q(
          "select email,kind,ts from pw_log where email=any($1) order by ts desc",
          [accounts.map((a) => a.email)],
        )
      : [];
    const b = await board();
    teams.forEach((t) => {
      const i = b.findIndex((x) => x.team_key === t.team_key);
      const entry = i >= 0 ? b[i] : null;
      t.points = entry?.pts ?? 0;
      t.rank = entry ? i + 1 : 0;
      t.accounts = accounts
        .filter((a) => a.team_key === t.team_key)
        .map((a) => ({
          ...a,
          history: hist.filter((h) => h.email === a.email),
        }));
    });
    const cnt = (n) => teams.filter((t) => t.size === n).length;
    res.json({
      teams,
      stats: {
        teams: teams.length,
        participants: teams.reduce((a, t) => a + t.size, 0),
        solo: cnt(1),
        two: cnt(2),
        three: cnt(3),
      },
      recent: [...teams]
        .sort((a, b) => b.created - a.created)
        .slice(0, 5)
        .map((t) => t.team_name),
    });
  });
  // Remove whole teams (emails, accounts, scores, submissions). Admin only.
  app.post("/api/admin/teams/remove", A, async (req, res) => {
    const keys = Array.isArray(req.body.team_keys)
      ? req.body.team_keys.filter((k) => typeof k === "string").slice(0, 200)
      : [];
    if (!keys.length) return bad(res, "No teams selected.");
    const c = await db.connect();
    try {
      await c.query("begin");
      await c.query("delete from solves where team_key=any($1)", [keys]);
      await c.query("delete from submissions where team_key=any($1)", [keys]);
      const r = await c.query(
        "delete from approved where team_key=any($1) returning email",
        [keys],
      ); // accounts are removed by FK cascade
      await c.query("delete from pw_log where email=any($1)", [
        r.rows.map((x) => x.email),
      ]);
      await c.query("commit");
      log("admin removed teams", req, { teams: keys.length });
      res.json({ teams: keys.length, emails: r.rowCount });
    } catch (e) {
      await c.query("rollback");
      throw e;
    } finally {
      c.release();
    }
  });
  // Remove one non-leader member email (and their account). Admin only.
  app.post("/api/admin/participants/remove", A, async (req, res) => {
    const email = em(req.body.email);
    if (!email) return bad(res, "Invalid email.");
    const client = await db.connect();
    let teamKey;
    try {
      await client.query("begin");
      const result = await client.query(
        "select team_key,leader_email from approved where email=$1 for update",
        [email],
      );
      const a = result.rows[0];
      if (!a) {
        await client.query("rollback");
        return bad(res, "Email not found.", 404);
      }
      if (a.leader_email === email) {
        await client.query("rollback");
        return bad(res, "This is the team leader. Remove the whole team instead.");
      }
      teamKey = a.team_key;
      await client.query("delete from approved where email=$1", [email]);
      await client.query("delete from pw_log where email=$1", [email]);
      const team = await client.query(
        "select members from approved where team_key=$1 limit 1 for update",
        [teamKey],
      );
      if (team.rows[0]) {
        const members = team.rows[0].members.filter((m) => m.email !== email);
        await client.query("update approved set members=$2,size=$3 where team_key=$1", [
          teamKey,
          JSON.stringify(members),
          members.length,
        ]);
      }
      await client.query("commit");
    } catch (e) {
      await client.query("rollback");
      throw e;
    } finally {
      client.release();
    }
    log("admin removed participant", req);
    res.json({ ok: true });
  });
  app.post("/api/admin/reset-code", A, async (req, res) => {
    const email = em(req.body.email),
      code = crypto.randomBytes(16).toString("hex").toUpperCase();
    const r =
      email &&
      (await q(
        "update users set reset_hash=$2,reset_expires=now()+interval '1 hour' where email=$1 returning email",
        [email, sha(code).toString("hex")],
      ));
    if (!r?.length) return bad(res, "No account for that email.", 404);
    res.json({ code, expires: "1 hour" });
  });
  const parseCsv = (text) => {
    const rows = [];
    let row = [],
      field = "",
      quoted = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (quoted) {
        if (ch === '"' && text[i + 1] === '"') {
          field += '"';
          i++;
        } else if (ch === '"') quoted = false;
        else field += ch;
      } else if (ch === '"' && !field.trim()) {
        field = "";
        quoted = true;
      } else if (ch === ",") {
        row.push(field.trim());
        field = "";
      } else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && text[i + 1] === "\n") i++;
        row.push(field.trim());
        if (row.some(Boolean)) rows.push(row);
        row = [];
        field = "";
      } else field += ch;
    }
    if (quoted) throw new Error("CSV contains an unclosed quoted field.");
    if (field.length || row.length) {
      row.push(field.trim());
      if (row.some(Boolean)) rows.push(row);
    }
    return rows;
  };
  app.post("/api/admin/import", A, async (req, res) => {
    // CSV columns: team, leader name, leader email, m1 name, m1 email, m2 name, m2 email
    if (typeof req.body.csv !== "string" || req.body.csv.length > 500000)
      return bad(res, "Invalid CSV.");
    let rows;
    try {
      rows = parseCsv(req.body.csv);
    } catch (e) {
      return bad(res, e.message);
    }
    if (rows.length > 5000) return bad(res, "CSV contains too many rows.");
    const entries = [],
      ownerByEmail = new Map(),
      seenLeaders = new Set();
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      const r = rows[rowIndex];
      const lead = em(r[2]);
      if (!lead || !r[0] || !r[1]) continue;
      if (seenLeaders.has(lead))
        return bad(res, `Leader email is repeated on CSV row ${rowIndex + 1}.`);
      seenLeaders.add(lead);
      const members = [{ name: r[1].slice(0, 80), email: lead }];
      for (const nameIndex of [3, 5]) {
        const name = r[nameIndex] || "",
          rawEmail = r[nameIndex + 1] || "",
          email = em(rawEmail);
        if (Boolean(name) !== Boolean(rawEmail))
          return bad(
            res,
            `Member name and email are both required on CSV row ${rowIndex + 1}.`,
          );
        if (rawEmail && !email)
          return bad(res, `Invalid member email on CSV row ${rowIndex + 1}.`);
        if (name && email && !members.some((m) => m.email === email))
          members.push({ name: name.slice(0, 80), email });
      }
      for (const member of members) {
        const priorTeam = ownerByEmail.get(member.email);
        if (priorTeam && priorTeam !== lead)
          return bad(
            res,
            `Email ${member.email} appears in multiple teams in the CSV.`,
          );
        ownerByEmail.set(member.email, lead);
      }
      entries.push({
        lead,
        teamName: r[0].slice(0, 80),
        leaderName: r[1].slice(0, 80),
        members,
      });
    }
    if (!entries.length) return bad(res, "CSV contains no valid teams.");
    const client = await db.connect();
    try {
      await client.query("begin");
      for (const entry of entries) {
        for (const member of entry.members) {
          await client.query(
            `insert into approved(email,team_key,team_name,leader_name,leader_email,members,size) values($1,$2,$3,$4,$5,$6,$7) on conflict(email) do update set team_key=$2,team_name=$3,leader_name=$4,leader_email=$5,members=$6,size=$7`,
            [
              member.email,
              entry.lead,
              entry.teamName,
              entry.leaderName,
              entry.lead,
              JSON.stringify(entry.members),
              entry.members.length,
            ],
          );
        }
      }
      await client.query("commit");
    } catch (e) {
      await client.query("rollback");
      throw e;
    } finally {
      client.release();
    }
    res.json({
      teams: entries.length,
      emails: entries.reduce((total, entry) => total + entry.members.length, 0),
    });
  });
};
