// ROUTES: admin challenge management. Create, edit, hide/disable, delete, file uploads.
const multer = require("multer");
const { db, q } = require("../db");
const { bad, log, sha } = require("../helpers");
const { A } = require("../middleware");
const { CATS, DIFFS, ALLOWED_EXT } = require("../settings");

module.exports = function register(app) {
  const FLAG_RE = /^[\x20-\x7E]{1,200}$/;
  const up = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 20e6, files: 5 },
    fileFilter: (r, f, cb) => {
      if (ALLOWED_EXT.includes(f.originalname.split(".").pop().toLowerCase()))
        return cb(null, true);
      const error = new Error("Unsupported upload file type.");
      error.status = 400;
      cb(error);
    },
  });
  const chal = (b, needFlag) => {
    const c = {
      title: String(b.title || "")
        .trim()
        .slice(0, 100),
      category: b.category,
      difficulty: b.difficulty,
      points: Number(b.points),
      description: String(b.description || "").slice(0, 5000),
      link: typeof b.link === "string" ? b.link.trim() : null,
      flag: typeof b.flag === "string" && b.flag.trim() ? b.flag.trim() : null,
    };
    let validLink = !c.link;
    if (c.link && c.link.length <= 2048) {
      try {
        const u = new URL(c.link);
        validLink =
          ["http:", "https:"].includes(u.protocol) && !u.username && !u.password;
      } catch {}
    }
    return c.title &&
      CATS.includes(c.category) &&
      DIFFS.includes(c.difficulty) &&
      Number.isInteger(c.points) &&
      c.points > 0 &&
      c.points <= 10000 &&
      validLink &&
      (!c.flag || FLAG_RE.test(c.flag)) &&
      (c.flag || !needFlag)
      ? c
      : null;
  };
  const addFiles = (query, id, fs = []) =>
    Promise.all(
      fs.map((f) =>
        query(
          "insert into files(challenge_id,name,mime,size,data) values($1,$2,$3,$4,$5)",
          [
            id,
            f.originalname.replace(/[^\w.\-]/g, "_").slice(0, 100),
            "application/octet-stream",
            f.size,
            f.buffer,
          ],
        ),
      ),
    );
  app.get("/api/admin/challenges", A, async (req, res) => {
    const cs = await q(
      "select c.id,c.title,c.category,c.difficulty,c.points,c.description,c.link,c.enabled,c.hidden,(select count(*)::int from solves s where s.challenge_id=c.id) solves from challenges c where not deleted order by id",
    );
    const fs = await q("select id,challenge_id,name,size from files");
    cs.forEach((c) => (c.files = fs.filter((f) => f.challenge_id === c.id)));
    res.json({ cs, CATS, DIFFS });
  });
  app.post("/api/admin/challenges", A, up.array("files"), async (req, res) => {
    const c = chal(req.body, true);
    if (!c)
      return bad(
        res,
        "Check title, category, difficulty, points, flag and link (links must start with http:// or https://).",
      );
    const client = await db.connect();
    try {
      await client.query("begin");
      const { rows } = await client.query(
        "insert into challenges(title,category,difficulty,points,description,link,flag_hash) values($1,$2,$3,$4,$5,$6,$7) returning id",
        [
          c.title,
          c.category,
          c.difficulty,
          c.points,
          c.description,
          c.link,
          sha(c.flag).toString("hex"),
        ],
      );
      await addFiles(client.query.bind(client), rows[0].id, req.files);
      await client.query("commit");
      res.json({ id: rows[0].id });
    } catch (e) {
      await client.query("rollback");
      throw e;
    } finally {
      client.release();
    }
  });
  app.put("/api/admin/challenges/:id", A, up.array("files"), async (req, res) => {
    // edits never touch existing solves/scores
    const id = Number(req.params.id),
      c = chal(req.body, false);
    if (!Number.isInteger(id) || id < 1 || id > 2147483647 || !c)
      return bad(res, "Invalid input. Links must start with http:// or https://.");
    const client = await db.connect();
    try {
      await client.query("begin");
      const updated = await client.query(
        "update challenges set title=$2,category=$3,difficulty=$4,points=$5,description=$6,link=$7,flag_hash=coalesce($8,flag_hash) where id=$1 and not deleted returning id",
        [
          id,
          c.title,
          c.category,
          c.difficulty,
          c.points,
          c.description,
          c.link,
          c.flag && sha(c.flag).toString("hex"),
        ],
      );
      if (!updated.rowCount) {
        await client.query("rollback");
        return bad(res, "Challenge not found.", 404);
      }
      if (req.body.replace_files === "1")
        await client.query("delete from files where challenge_id=$1", [id]);
      await addFiles(client.query.bind(client), id, req.files);
      await client.query("commit");
      res.json({ ok: true });
    } catch (e) {
      await client.query("rollback");
      throw e;
    } finally {
      client.release();
    }
  });
  app.patch("/api/admin/challenges/:id", A, async (req, res) => {
    const id = Number(req.params.id),
      b = (x) => (typeof x === "boolean" ? x : null);
    if (!Number.isInteger(id) || id < 1 || id > 2147483647)
      return bad(res, "Invalid input.");
    const updated = await q(
      "update challenges set enabled=coalesce($2,enabled),hidden=coalesce($3,hidden) where id=$1 and not deleted returning id",
      [id, b(req.body.enabled), b(req.body.hidden)],
    );
    if (!updated.length) return bad(res, "Challenge not found.", 404);
    res.json({ ok: true });
  });
  app.delete("/api/admin/challenges/:id", A, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1 || id > 2147483647)
      return bad(res, "Invalid input.");
    const c = await db.connect();
    try {
      await c.query("begin");
      const deleted = await c.query(
        "update challenges set deleted=true,enabled=false where id=$1 and not deleted returning id",
        [id],
      );
      if (!deleted.rowCount) {
        await c.query("rollback");
        return bad(res, "Challenge not found.", 404);
      }
      const removed = await c.query("delete from solves where challenge_id=$1", [id]);
      await c.query("delete from files where challenge_id=$1", [id]);
      await c.query("commit");
      log("admin deleted challenge and removed awarded points", req, {
        challenge: id,
        solvesRemoved: removed.rowCount,
      });
      res.json({ ok: true, solvesRemoved: removed.rowCount });
    } catch (e) {
      await c.query("rollback");
      throw e;
    } finally {
      c.release();
    }
  });
};
