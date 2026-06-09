# ToDo / Roadmap

This file tracks the gaps between `sharp-lint-staged` and its predecessor
`imagemin-lint-staged`, plus ideas and recommendations for future work.

## Feature parity status

| Capability                          | imagemin-lint-staged            | sharp-lint-staged                          | Status        |
| ----------------------------------- | ------------------------------- | ------------------------------------------ | ------------- |
| GIF optimisation                    | `imagemin-gifsicle`             | `sharp.gif()` (effort 10, frames preserved) | ✅ Parity      |
| PNG optimisation                    | `imagemin-optipng`              | `sharp.png()` (level 9, effort 10, lossless) | ✅ Parity      |
| JPEG optimisation                   | `imagemin-jpegtran` (lossless)  | `sharp.jpeg()` (mozjpeg, **lossy re-encode**) | ⚠️ Differs    |
| SVG optimisation                    | `imagemin-svgo`                 | `svgo` directly                            | ✅ Parity      |
| cosmiconfig configuration           | yes                             | yes (renamed module)                        | ✅ Parity      |
| ESM config file support             | yes                             | yes                                        | ✅ Parity      |
| Per-format defaults                 | yes                             | yes                                        | ✅ Parity      |
| CLI for lint-staged                 | `bin/index.js`                  | `dist/cli.js`                              | ✅ Parity      |
| In-place optimisation               | yes (always writes)             | yes (writes only if smaller)               | ✅ + safer     |
| release-it release script           | yes                             | yes                                        | ✅ Parity      |
| GitHub PR + publish workflows       | yes                             | yes                                        | ✅ Parity      |
| Test suite                          | jest (mocked plugins)           | vitest (real fixtures)                     | ✅ + stronger  |

## Known differences (intentional)

1. **JPEG is lossy.** sharp has no byte-level lossless JPEG optimiser equivalent
   to `jpegtran`. sharp re-encodes with mozjpeg. The "write only if smaller"
   guard prevents repeated commits from compounding quality loss, but the first
   pass is a re-encode at `quality: 80`.
   - _Recommendation:_ If true lossless JPEG is required, keep an optional
     `jpegtran`/`mozjpeg`-CLI hook, or expose a `lossless`-style escape hatch.
2. **PNG/GIF/SVG remain effectively lossless** with the default config, and the
   write guard makes them idempotent (a second run does not change the file).
3. **Write-if-smaller guard** is new behaviour. imagemin always wrote the plugin
   output. We only overwrite when the result is strictly smaller, which avoids
   ever growing an asset.

## Missing features / not yet implemented

- [ ] **Lossless JPEG mode.** No equivalent to `jpegtran` lossless transforms.
- [ ] **Explicit `git add` re-staging.** Currently relies on lint-staged to
      re-stage modified files (its documented behaviour). The original imagemin
      package did the same. A standalone `--stage` flag could be added for
      non-lint-staged usage.
- [ ] **Per-file logging / summary output.** No reporting of bytes saved.
- [ ] **Disabling a single format via config.** All formats are always handled;
      there is no `{ png: false }` opt-out yet (imagemin had the same limitation).
- [ ] **Concurrency limiting.** Files are processed with `Promise.all`. For very
      large staged sets this could spike memory; a small concurrency pool would help.

## Ideas and recommendations

- [ ] **Modern output formats.** sharp can additionally emit WebP, AVIF and
      TIFF. Consider optional `webp`/`avif` config keys, or a "convert to webp"
      companion mode (would change file extensions, so opt-in only).
- [ ] **`resize` is already supported** (off by default). Document recipes for
      capping hero-image dimensions in CI.
- [ ] **Metadata stripping toggle.** sharp strips most metadata by default;
      expose `withMetadata()` for users who need to keep EXIF/ICC.
- [ ] **Byte-savings report** printed to stdout for visibility in commit hooks.
- [ ] **Benchmark harness** comparing output sizes vs. imagemin on a fixture set,
      to document the compression delta.
- [ ] **Prettier/ESLint + qlty wiring** for the TS source (prettier is installed;
      consider adding ESLint with a TS config).

## Done

- [x] Replace imagemin (gifsicle/jpegtran/optipng) with sharp for GIF/PNG/JPEG.
- [x] Replace `imagemin-svgo` with `svgo` directly for SVG.
- [x] TypeScript source (`src/`) compiled to `dist/`.
- [x] cosmiconfig configuration with per-format defaults and ESM support.
- [x] CLI entry point wired for lint-staged.
- [x] Idempotent, write-if-smaller behaviour.
- [x] vitest test suite running against real image fixtures.
- [x] README, CHANGELOG, LICENSE, release-it config, GitHub workflows.
