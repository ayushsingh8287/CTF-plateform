const crypto = require("crypto");
const { db } = require("./db");
const { hmac } = require("./helpers");

async function consumeOtp(prefix, input) {
  const code = typeof input === "string" ? input.trim() : "";
  if (!/^\d{6}$/.test(code)) return false;

  const hashKey = `${prefix}_hash`,
    expiresKey = `${prefix}_exp`,
    triesKey = `${prefix}_tries`,
    client = await db.connect();
  try {
    await client.query("begin");
    const result = await client.query(
      "select key,value from admin_cfg where key=any($1) for update",
      [[hashKey, expiresKey, triesKey]],
    );
    const values = Object.fromEntries(result.rows.map((row) => [row.key, row.value])),
      hash = values[hashKey],
      expires = Number(values[expiresKey] || 0),
      tries = Number(values[triesKey] || 0);
    if (
      !hash ||
      !Number.isFinite(expires) ||
      !Number.isInteger(tries) ||
      Date.now() > expires ||
      tries >= 5
    ) {
      await client.query("rollback");
      return false;
    }

    const expected = Buffer.from(hmac(code), "hex"),
      stored = Buffer.from(hash, "hex"),
      valid =
        expected.length === stored.length && crypto.timingSafeEqual(expected, stored);
    if (valid) {
      await client.query(
        "update admin_cfg set value=case key when $1 then '' when $2 then '0' else '0' end where key=any($3)",
        [hashKey, expiresKey, [hashKey, expiresKey, triesKey]],
      );
    } else {
      await client.query("update admin_cfg set value=$2 where key=$1", [
        triesKey,
        String(tries + 1),
      ]);
    }
    await client.query("commit");
    return valid;
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }
}

module.exports = { consumeOtp };
