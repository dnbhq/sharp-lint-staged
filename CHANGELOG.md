# Changelog

## 1.0.0

Initial release of `@dnbhq/sharp-lint-staged`, a sharp-powered
successor to [`@davidsneighbour/imagemin-lint-staged`](https://github.com/davidsneighbour/imagemin-lint-staged).

### Features

* Optimise staged GIF, PNG and JPEG images with [`sharp`](https://www.npmjs.com/package/sharp) instead of the unmaintained `imagemin` toolchain.
* Optimise staged SVG images with [`svgo`](https://www.npmjs.com/package/svgo) directly.
* cosmiconfig-based configuration under the `sharp-lint-staged` module name, with per-format defaults and ESM config file support.
* TypeScript source compiled to `dist/`, shipping type declarations.
* Write-if-smaller behaviour: files are only rewritten when the optimised result is strictly smaller, making PNG/GIF/SVG optimisation idempotent.
* Optional `resize` support (disabled by default).

### Notes

* JPEG optimisation is a mozjpeg re-encode (lossy) rather than the byte-level lossless transform performed by `jpegtran`. See [ToDo.md](ToDo.md) for details and the full feature-parity matrix versus `imagemin-lint-staged`.
