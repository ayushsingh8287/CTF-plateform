const { spawn } = require("node:child_process");
const path = require("node:path");

const root = path.join(__dirname, "..");
const services = [
  {
    name: "backend",
    cwd: path.join(root, "backend"),
    args: ["--watch", "server.js"],
    env: { PORT: "3001" },
  },
  {
    name: "frontend",
    cwd: path.join(root, "frontend"),
    args: [path.join("node_modules", "vite", "bin", "vite.js")],
    env: { API_PORT: "3001" },
  },
];

const children = [];
let stopping = false;
let remaining = services.length;
let exitCode = 0;

function stop(signal = "SIGTERM") {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.exitCode === null) child.kill(signal);
  }
}

for (const service of services) {
  const child = spawn(process.execPath, service.args, {
    cwd: service.cwd,
    env: { ...process.env, ...service.env },
    stdio: "inherit",
  });
  children.push(child);
  child.on("error", (error) => {
    console.error(`Could not start ${service.name}: ${error.message}`);
    exitCode = 1;
    stop();
  });
  child.on("exit", (code, signal) => {
    if (!stopping) {
      exitCode = code ?? (signal ? 1 : 0);
      stop();
    }
    remaining -= 1;
    if (remaining === 0) process.exit(exitCode);
  });
}

process.on("SIGINT", () => stop("SIGINT"));
process.on("SIGTERM", () => stop("SIGTERM"));
