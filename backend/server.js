// BACKEND ENTRY POINT. Start with:  npm start   (from the project root)
// This file only wires things together. The real code lives in backend/src/:
//   src/settings.js   -> numbers you may want to change (lockout timers, categories, default flag)
//   src/routes/*.js   -> every URL the website calls, grouped by topic
//   src/middleware.js -> security rules + login guards
//   src/db.js         -> database tables and query helpers
//   src/helpers.js    -> email, hashing, rate limits and other small tools
const express = require("express");
const { E } = require("./src/env");
const { init } = require("./src/db");
const { bad } = require("./src/helpers");
const { applySecurity } = require("./src/middleware");

const app = express();
app.set("trust proxy", 1);
applySecurity(app);

// Every file below adds its own URLs to the app (order matters only for the 404 line after them).
require("./src/routes/auth")(app);
require("./src/routes/participant")(app);
require("./src/routes/adminLogin")(app);
require("./src/routes/adminPassword")(app);
require("./src/routes/adminMfa")(app);
require("./src/routes/adminTeams")(app);
require("./src/routes/adminChallenges")(app);
require("./src/routes/adminActivity")(app);

app.use("/api", (req, res) => bad(res, "Not found", 404));
app.use((e, req, res, next) => {
  if (res.headersSent) return next(e);
  console.error(e.message);
  const status =
    e.status ||
    (e.code === "LIMIT_FILE_SIZE" ? 413 : e.name === "MulterError" ? 400 : 500);
  res.status(status).json({
    error: status < 500 ? e.message : "Something went wrong",
  });
});
init()
  .then(() => app.listen(E.PORT || 3000, () => console.log("CTF platform up")))
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
