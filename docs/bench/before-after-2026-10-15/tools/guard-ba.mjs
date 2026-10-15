// Refuse anything but the private bench daemon.
import { readFileSync, realpathSync } from "node:fs";
import { execFileSync } from "node:child_process";
export const HOME = realpathSync(`${process.env.HOME}/.paseo-bench-p0p1`);
export const PORT = 6871;
const FORBIDDEN = [6767, 6868, 6869];
const cfg = JSON.parse(readFileSync(`${HOME}/config.json`, "utf8"));
if (cfg.daemon?.listen !== `127.0.0.1:${PORT}`) throw new Error(`private home listens on ${cfg.daemon?.listen}`);
if (FORBIDDEN.includes(PORT)) throw new Error("forbidden port");
const PASEO_BIN = process.env.BC_PASEO_BIN ?? process.env.PASEO_BIN ?? "paseo";
const status = execFileSync(PASEO_BIN, ["--home", HOME, "daemon", "status"], { encoding: "utf8" });
if (!status.includes(`listen: 127.0.0.1:${PORT}`)) throw new Error(`daemon status mismatch:\n${status}`);
export const SERVER_ID = readFileSync(`${HOME}/server-id`, "utf8").trim();
export const paseo = (...rest) =>
  execFileSync(PASEO_BIN, ["--home", HOME, ...rest], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
export const BLOCK_WS = /:(6767|6868|6869)\//;
