#!/usr/bin/env node
/**
 * Start the MVP Next.js text interview application.
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const shell = process.platform === "win32";

function run(name, command, args) {
  const child = spawn(command, args, {
    cwd: root,
    stdio: "inherit",
    shell,
    env: process.env,
  });
  child.on("exit", (code) => {
    if (code && code !== 0) {
      console.warn(`[dev-stack] ${name} exited with code ${code}`);
    }
  });
  return child;
}

const children = [run("next", "pnpm", ["run", "dev"])];

function shutdown() {
  for (const child of children) {
    if (!child.killed) child.kill("SIGTERM");
  }
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

console.log("[dev-stack] Next.js text interview MVP starting…");
