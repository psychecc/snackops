import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const port = process.env.DEPLOY_RUN_PORT || "5000";
const require = createRequire(import.meta.url);
const nextCli = require.resolve("next/dist/bin/next");

const child = spawn(process.execPath, [nextCli, "dev", "-p", port], {
  stdio: "inherit",
  shell: false,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
