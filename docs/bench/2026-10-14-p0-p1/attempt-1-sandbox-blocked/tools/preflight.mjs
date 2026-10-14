import { existsSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

const EXPECTED_HOME = resolve(join(homedir(), ".paseo-bench-p0p1"));
const EXPECTED_PORT = 6871;
const FORBIDDEN_PORTS = new Set([6767, 6868, 6869]);

export function assertBenchTarget() {
  const configuredHome = process.env.BC_BENCH_HOME;
  const configuredPort = Number(process.env.BC_BENCH_PORT);
  if (!configuredHome || resolve(configuredHome) !== EXPECTED_HOME) {
    throw new Error(`Refusing non-private Paseo home: ${configuredHome ?? "unset"}`);
  }
  if (FORBIDDEN_PORTS.has(configuredPort)) {
    throw new Error(`Refusing forbidden daemon port ${configuredPort}`);
  }
  if (configuredPort !== EXPECTED_PORT) {
    throw new Error(`Expected private daemon port ${EXPECTED_PORT}, got ${configuredPort}`);
  }
  if (existsSync(EXPECTED_HOME) && realpathSync(EXPECTED_HOME) !== EXPECTED_HOME) {
    throw new Error(`Refusing aliased private home: ${EXPECTED_HOME}`);
  }
  return { home: EXPECTED_HOME, port: EXPECTED_PORT };
}

export const PRIVATE_TARGET = assertBenchTarget();
