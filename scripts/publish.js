#!/usr/bin/env node
// Publish wrapper that guarantees pi.extensions restoration on any exit path.
//
// npm runs postpublish only on successful publish, so a failed or
// interrupted publish leaves the manifest pointing at ./dist after
// prepublishOnly rewrote it. This wrapper restores the manifest on normal
// exit, on process exit, and on SIGINT/SIGTERM, covering every failure
// mode except SIGKILL. Direct `npm publish` still works and relies on
// postpublish (see package.json scripts); `npm run release` is the
// recommended hardened path.
//
// Usage: npm run release [-- <npm publish args>]
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const manifestPath = "package.json";
const RESTORED_ENTRY = "./index.ts";

let restored = false;
function restore() {
  if (restored) return;
  restored = true;
  try {
    const pkg = JSON.parse(readFileSync(manifestPath, "utf8"));
    if (pkg.pi && Array.isArray(pkg.pi.extensions) && pkg.pi.extensions[0] !== RESTORED_ENTRY) {
      pkg.pi.extensions = [RESTORED_ENTRY];
      writeFileSync(manifestPath, `${JSON.stringify(pkg, null, 2)}\n`);
      console.log(`pi.extensions restored -> ${RESTORED_ENTRY}`);
    }
  } catch (error) {
    console.error(`could not restore pi.extensions: ${error.message}`);
  }
}

process.on("exit", restore);
process.on("SIGINT", () => {
  restore();
  process.exit(130);
});
process.on("SIGTERM", () => {
  restore();
  process.exit(143);
});

const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
const result = spawnSync(npmCmd, ["publish", ...process.argv.slice(2)], { stdio: "inherit" });
process.exit(result.status ?? 1);
