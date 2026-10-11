# S0-A: measurement and dependency infrastructure

No user-visible change. Baseline commit `42b61d8`.

## Dependencies

- `@getpaseo/plugin` 0.8.0 -> 0.11.2 (dev). `npm run typecheck` needed no source changes. `paseo-plugin.json` still requires `>=0.8.0`.
- Runtime: `marked@18.1.0`, `remend@1.4.0`. Dev: `vitest`.
- Harness-only packages (`esbuild`, `playwright-core`, `react-dom`, `react-native-web`, `lucide-react`) live in `.showcase/package.json`, so the daemon's `npm ci --include=dev` for the plugin does not install them. `playwright-core` downloads no browser; the replay uses the local Chrome (`CHROME_PATH` to override).

## Client bundle size

Host settings: `.showcase/tools/bundle-size.mjs` (esbuild, cjs, platform neutral, mainFields module/main, SDK specifiers/react/react-native/zod/react-query external, unminified, as in `compiler.ts` `compileTarget`).

| Build | bytes | gzip |
|---|---|---|
| `42b61d8` baseline | 650,199 | 287,117 |
| + perf probes (store, hooks) | 662,996 (+12,797) | 290,691 |
| + `marked` + `remend` (debug probe import) | 748,479 (+85,483) | 313,952 |

Total vs baseline: +98,280 bytes raw, +26,835 gzip. `marked` and `remend` are present in the bundle (metafile check).

## Bundling smoke test

- Isolated daemon `~/.paseo-bench` (port 6868, Paseo 0.11.2). The worktree was installed as plugin id `bc-s0-infra` (the id `beautiful-chat` already pointed at the main checkout there). `plugin ls`: `running`, empty ERROR column; `plugin logs`: `Loading plugin` -> `Plugin ready`; daemon log: `Loaded plugin` with methods `file.image`, `file.reveal`, `highlight.tokens`. The entry was then removed again.
- The daemon only compiles the client; it is evaluated by the app. To prove the modules also *run* after the host's esbuild settings, `node .showcase/tools/bundle-probe-run.mjs` bundles `client/debug/bundle-probe.ts` the same way and runs it: `Lexer` tokenised `heading,space,code,space,list` and `remend("some **unfinished bold")` returned `some **unfinished bold**`.
- The probe is reached from `index.client.tsx` behind `getEnhancerPreferences().debugPerf`, so it is not tree-shaken and does not run in a normal session.

## Perf probes (`client/debug/`)

- `store.ts`: pure aggregation (unit tested). `perf.ts`: wiring. Guard: every probe starts with `if (!on) return ...`; `probeCard` returns one frozen shared object, so a disabled card render allocates nothing and adds no hooks.
- Enable with the hidden `debugPerf` preference or `__bcPerf.enable()` / `.disable()`; read with `.snapshot()`, `.reset()`, `.report()` (console tables).
- Hooks in existing code: `live-renderers.tsx` (five card renderers: `probeCard`, `onLayout` on the root, an effect node), `markdown-view.tsx` (`probeMarkdown`, optional `probeId` prop), `highlight.ts` (`probeHighlightRpc` before the RPC), `breathe.tsx` / `pulse-dot.tsx` / `motion.tsx` `Glow` (`probeAnimationLoop`).
- Caveat: the assistant item has no `phase` in its data, so its height decreases are reported with `streaming: null`.

## Replay harness

```
npm run replay -- [--fixtures dir] [--only name] [--speed 1] [--host current|cached] [--out dir] [--dev] [--headed]
```

- Default fixtures: `.showcase/fixtures-smoke/` (2 files). Output: `<out>/<fixture>.snapshot.json` (+ `.png`), default `.showcase/out/` (git-ignored).
- The snapshot holds `streaming` (taken before the end-of-stream flip), `settled`, and `idle` (1.5 s after settle, counters reset) probe snapshots, plus the harness's own transformer timing.
- `--host current` re-creates `theme` and re-runs `safeParse` for every row on every event, like Paseo 0.11.2; `--host cached` caches both and memoises rows (the planned H4 + S1 shape). Not simulated: the host's reveal cadence for reasoning text, host-native rendering of declined items.
- Screenshot parity: `node .showcase/tools/shots.mjs <dir> <out>` builds the showcase and captures every `#shot-*` (rAF frozen). All 21 shots from this branch are byte-identical to baseline `42b61d8`.

### Smoke results (speed 1, production React, Chrome headless, `--host current`)

| fixture | events | stream ms | user_message renders | assistant renders | tool_call renders | parses | format flips | highlight RPC | dropped frames | idle animations |
|---|---|---|---|---|---|---|---|---|---|---|
| smoke-markdown-code | 109 | 5063 | 109 | 106 | - | 105 | 3 | 1 | 0 | 0 |
| smoke-bash-tool | 17 | 2824 | 17 | 27 | 11 | 14 | 0 | 0 | 0 | 2 (`Breathe`) |

The user message re-renders on every chunk (109 renders for 109 events); with `--host cached` it renders once. The unclosed code fence flips block kinds 3 times and the bash fixture ends with 2 `Breathe` loops still mounted when idle. Both are the hot spots the plan targets.
