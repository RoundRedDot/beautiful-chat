import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { PRIVATE_TARGET } from "./preflight.mjs";

export function paseo(...args) {
  return execFileSync("paseo", ["--home", PRIVATE_TARGET.home, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = paseo(...process.argv.slice(2));
  process.stdout.write(result);
}
