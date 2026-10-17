import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

export function admitted(sample) {
  return Number.isFinite(sample.cpuIdlePct) && sample.cpuIdlePct >= 15 &&
    Number.isFinite(sample.memoryFreePct) && sample.memoryFreePct >= 10 && sample.pressureLevel === 1;
}

export function validateResume(sample, scenario, mode, rep) {
  if (!sample.completed || sample.error || sample.scenario !== scenario || sample.mode !== mode || String(sample.rep) !== String(rep) ||
      sample.seed?.fixtureSha256 !== '401cba25910431543cb9be5a68110674825e0204701ace37678d809f8c9725e7') {
    throw Error('existing sample is not a successful matching run; preserve and inspect it');
  }
  return sample;
}

export function resources() {
  const sh = (file, args) => execFileSync(file, args, { encoding: 'utf8', timeout: 30000 }).trim();
  const top = sh('/usr/bin/top', ['-l', '1', '-n', '0']);
  const memory = sh('/usr/bin/memory_pressure', ['-Q']);
  const sample = {
    at: new Date().toISOString(),
    cpuIdlePct: Number(top.match(/CPU usage:.*?([\d.]+)% idle/)?.[1]),
    memoryFreePct: Number(memory.match(/free percentage:\s*(\d+)%/)?.[1]),
    pressureLevel: Number(sh('/usr/sbin/sysctl', ['-n', 'kern.memorystatus_vm_pressure_level'])),
    load: sh('/usr/sbin/sysctl', ['-n', 'vm.loadavg']).replace(/[{}]/g, '').trim().split(/\s+/).map(Number),
    concurrentTasks: [2, 3, 4].flatMap(lane => {
      const path = `/tmp/bc-ios-five-parallel-20261016/lane${lane}/activity.json`;
      return existsSync(path) ? [JSON.parse(readFileSync(path, 'utf8'))] : [];
    }),
  };
  return { ...sample, admitted: admitted(sample) };
}
