// Small, dependency-free helpers for authenticator-app codes (RFC 6238 TOTP) and for encrypting the secret at rest.
const crypto = require("crypto");
module.exports = (secret) => {
  const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567",
    KEY = crypto
      .createHash("sha256")
      .update("mfa:" + secret)
      .digest();
  const b32enc = (buf) => {
    let bits = "",
      o = "";
    for (const x of buf) bits += x.toString(2).padStart(8, "0");
    for (let i = 0; i < bits.length; i += 5)
      o += B32[parseInt(bits.slice(i, i + 5).padEnd(5, "0"), 2)];
    return o;
  };
  const b32dec = (s) => {
    let bits = "";
    for (const c of s) bits += B32.indexOf(c).toString(2).padStart(5, "0");
    const o = [];
    for (let i = 0; i + 8 <= bits.length; i += 8)
      o.push(parseInt(bits.slice(i, i + 8), 2));
    return Buffer.from(o);
  };
  const hotp = (key, ctr) => {
    const b = Buffer.alloc(8);
    b.writeBigUInt64BE(BigInt(ctr));
    const h = crypto.createHmac("sha1", key).update(b).digest(),
      o = h[19] & 15;
    return String(
      (((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]) % 1000000,
    ).padStart(6, "0");
  };
  const encS = (t) => {
    const iv = crypto.randomBytes(12),
      c = crypto.createCipheriv("aes-256-gcm", KEY, iv),
      ct = Buffer.concat([c.update(t, "utf8"), c.final()]);
    return [iv, c.getAuthTag(), ct].map((x) => x.toString("base64")).join(".");
  };
  const decS = (t) => {
    const [iv, tag, ct] = t.split(".").map((x) => Buffer.from(x, "base64")),
      d = crypto.createDecipheriv("aes-256-gcm", KEY, iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(ct), d.final()]).toString("utf8");
  };
  return { b32enc, b32dec, hotp, encS, decS };
};
