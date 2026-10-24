// ENV: loads backend/.env (local runs) and checks that the important secrets exist.
// On a host like Render the values come from its "Environment" page instead.
// Other files do:  const { E, PROD } = require("./env");   (E = all environment variables)
const fs = require("fs"),
  path = require("path");
const envFile = path.join(__dirname, "..", ".env");
if (fs.existsSync(envFile)) {
  for (const l of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env))
      process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
}
const E = process.env,
  PROD = E.NODE_ENV === "production";

const required = ["DATABASE_URL", "JWT_SECRET", "ADMIN_EMAIL", "ADMIN_PASSWORD_HASH"];
const problems = required
  .filter((key) => !E[key]?.trim())
  .map((key) => `Missing ${key}`);
if (E.DATABASE_URL) {
  try {
    if (!["postgres:", "postgresql:"].includes(new URL(E.DATABASE_URL).protocol))
      problems.push("DATABASE_URL must be a PostgreSQL connection URL");
  } catch {
    problems.push("DATABASE_URL is not a valid URL");
  }
}
if (E.JWT_SECRET && E.JWT_SECRET.length < 32)
  problems.push("JWT_SECRET must be at least 32 characters");
if (E.ADMIN_EMAIL && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(E.ADMIN_EMAIL))
  problems.push("ADMIN_EMAIL must be a valid email address");
if (
  E.ADMIN_PASSWORD_HASH &&
  !/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(E.ADMIN_PASSWORD_HASH)
)
  problems.push("ADMIN_PASSWORD_HASH must be a valid bcrypt hash");
if (problems.length) {
  console.error(
    `Invalid environment configuration: ${problems.join("; ")}.\n` +
      `Set them in ${envFile} or in your hosting provider's environment settings.`,
  );
  if (!fs.existsSync(envFile))
    console.error(
      "For local development, create backend\\.env by copying backend\\.env.example.",
    );
  process.exit(1);
}
module.exports = { E, PROD };
