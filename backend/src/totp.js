// TOTP: checks authenticator-app codes and one-time recovery codes for the admin login.
const { E } = require("./env");
const { db, q, cfg } = require("./db");
const { hmac, eqStr, safeJson } = require("./helpers");
const { b32enc, b32dec, hotp, encS, decS } = require("./mfa")(E.JWT_SECRET);

async function checkTotp(cfgKey, code, mark = true) {
  // each code works once: a code from an older or the same 30s step is refused
  const enc = await cfg(cfgKey);
  if (!enc || typeof code !== "string" || !/^\d{6}$/.test(code.trim())) return false;
  const key = b32dec(decS(enc)),
    step = Math.floor(Date.now() / 30000);
  for (const d of [-1, 0, 1]) {
    const candidate = step + d;
    if (!eqStr(hotp(key, candidate), code.trim())) continue;
    if (!mark) return true;
    const claimed = await q(
      `insert into admin_cfg(key,value) values('mfa_last',$1)
       on conflict(key) do update set value=excluded.value
       where admin_cfg.value::bigint < excluded.value::bigint returning value`,
      [String(candidate)],
    );
    if (claimed.length) return true;
  }
  return false;
}
async function useRecovery(code) {
  // one-time backup codes, stored only as HMACs
  const c = String(code)
    .toLowerCase()
    .replace(/[^a-f0-9]/g, "");
  if (c.length !== 10) return false;
  const client = await db.connect();
  try {
    await client.query("begin");
    const result = await client.query(
      "select value from admin_cfg where key='mfa_recovery' for update",
    );
    const list = safeJson(result.rows[0]?.value, []);
    const i = Array.isArray(list) ? list.indexOf(hmac("rc:" + c)) : -1;
    if (i < 0) {
      await client.query("rollback");
      return false;
    }
    list.splice(i, 1);
    await client.query("update admin_cfg set value=$1 where key='mfa_recovery'", [
      JSON.stringify(list),
    ]);
    await client.query("commit");
    return true;
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }
}

module.exports = { checkTotp, useRecovery, b32enc, encS };
