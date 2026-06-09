# Sharp-lint-staged

> [sharp](https://sharp.pixelplumbing.com/)-powered image optimisation CLI designed for lint-staged usage with sensible defaults

[![Version][npm-image]][npm-url] [![PR Workflow][github-workflows-pr-image]][github-workflows-pr-url]

This is a drop-in successor to [`@davidsneighbour/imagemin-lint-staged`](https://github.com/davidsneighbour/imagemin-lint-staged). It keeps the same workflow — optimise staged images on commit — but replaces the unmaintained `imagemin` toolchain (which ships a long tail of security advisories on its native binary dependencies) with [`sharp`](https://www.npmjs.com/package/sharp) for raster images and the actively maintained [`svgo`](https://www.npmjs.com/package/svgo) for SVG.

Raster formats (GIF, PNG, JPEG) are handled by sharp's modern libvips-based encoders. SVG is handled by svgo directly, with no `imagemin` wrapper in between.

## Why switch from imagemin?

* `imagemin` and its plugins are effectively unmaintained and pull in native binaries (`gifsicle`, `jpegtran`, `optipng`) that generate repeated `npm audit` advisories.
* `sharp` is a single, well-maintained, prebuilt native dependency covering GIF, PNG and JPEG (plus WebP, AVIF and TIFF if you want them later).
* `svgo` replaces `imagemin-svgo` with no loss of functionality.

## Installation

```sh
npm i --save-dev @davidsneighbour/sharp-lint-staged
```

Requires Node.js 22 or newer.

## Usage

Use in conjunction with [lint-staged][lint-staged]. In your `package.json`:

```json
"lint-staged": {
  "*.{png,jpeg,jpg,gif,svg}": ["sharp-lint-staged"]
}
```

On commit, every staged image matching the glob is optimised in place. `lint-staged` automatically re-stages the modified files. The optimised buffer is only written back when it is **strictly smaller** than the original, so already-optimised images are left untouched and repeated runs converge to a stable file.

You can also call the API directly:

```ts
import { optimizeFile } from '@davidsneighbour/sharp-lint-staged';

const wasRewritten = await optimizeFile('assets/logo.png');
```

`optimizeFile` resolves to `true` when the file was rewritten with a smaller result, and `false` when it was left unchanged (already optimal, or an unsupported format).

## Configuration

The package uses [cosmiconfig][cosmiconfig] with the module name `sharp-lint-staged`. You can configure the encoders from a project-level configuration file instead of changing the package source.

Configuration is searched from the current working directory. For normal `lint-staged` usage this is usually the repository root, because `lint-staged` runs from there.

Supported configuration locations include:

* `package.json`, using the `sharp-lint-staged` property
* `.sharp-lint-stagedrc`
* `.sharp-lint-stagedrc.{json,yaml,yml,js,ts,mjs,cjs}`
* `.config/sharp-lint-stagedrc`
* `.config/sharp-lint-stagedrc.{json,yaml,yml,js,ts,mjs,cjs}`
* `sharp-lint-staged.config.{js,ts,mjs,cjs}`

cosmiconfig's asynchronous API is used, so ESM configuration files are supported. In ESM projects, prefer `sharp-lint-staged.config.js` or `sharp-lint-staged.config.mjs` with `export default`.

### Default configuration

The built-in defaults favour the strongest encoder effort available in sharp while keeping JPEG re-encoding visually close to the source. SVG optimisation mirrors the lossless, accessibility-friendly preset from the predecessor package.

```js
export default {
  jpeg: {
    quality: 80,
    mozjpeg: true,
    progressive: true,
  },
  png: {
    compressionLevel: 9,
    effort: 10,
    palette: false,
    progressive: false,
  },
  gif: {
    effort: 10,
  },
  svg: {
    multipass: true,
    plugins: [
      {
        name: 'preset-default',
        params: {
          // svgo v4 keeps `viewBox` by default; only the remaining
          // safety overrides are needed.
          overrides: {
            cleanupIds: false,
            removeDesc: false,
          },
        },
      },
    ],
  },
  resize: null,
};
```

### Example using `package.json`

```json
{
  "sharp-lint-staged": {
    "jpeg": { "quality": 82, "mozjpeg": true },
    "png": { "compressionLevel": 9, "effort": 10 },
    "gif": { "effort": 10 }
  }
}
```

### Example using `.sharp-lint-stagedrc.json`

```json
{
  "png": { "compressionLevel": 9, "effort": 10, "palette": true, "quality": 90 },
  "svg": {
    "multipass": true,
    "plugins": [{ "name": "preset-default" }]
  }
}
```

### Example using `sharp-lint-staged.config.mjs`

```js
export default {
  // Resize is OFF by default. Enable it to cap the maximum width:
  resize: { width: 2000, withoutEnlargement: true },
  jpeg: { quality: 80, mozjpeg: true, progressive: true },
};
```

## Options

All options are optional. Each top-level key configures one encoder.

| Option   | Engine | Passed to                                                                             | Default                                                                   |
| -------- | ------ | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `jpeg`   | sharp  | [`sharp.jpeg()`](https://sharp.pixelplumbing.com/api-output#jpeg)                      | `{ quality: 80, mozjpeg: true, progressive: true }`                       |
| `png`    | sharp  | [`sharp.png()`](https://sharp.pixelplumbing.com/api-output#png)                        | `{ compressionLevel: 9, effort: 10, palette: false, progressive: false }` |
| `gif`    | sharp  | [`sharp.gif()`](https://sharp.pixelplumbing.com/api-output#gif)                        | `{ effort: 10 }`                                                          |
| `svg`    | svgo   | [`svgo.optimize()`](https://svgo.dev/docs/introduction/)                               | `preset-default` with `cleanupIds`/`removeDesc` disabled (viewBox kept)   |
| `resize` | sharp  | [`sharp.resize()`](https://sharp.pixelplumbing.com/api-resize) (only when non-`null`)  | `null` (no resizing)                                                      |

The object for each key is passed directly to the matching engine method.

### Default option details

* **`jpeg`** uses `mozjpeg: true` for the best compression sharp offers, plus `progressive: true` for better perceived load time. `quality: 80` is a widely-used near-transparent default. JPEG is re-encoded rather than losslessly rewritten — see the [trade-offs](#trade-offs-and-known-differences) below.
* **`png`** uses the maximum `compressionLevel` (9) and `effort` (10). `palette: false` keeps output lossless; set `palette: true` (optionally with `quality`/`colours`) to enable lossy palette quantisation for much smaller files.
* **`gif`** uses the maximum `effort` (10). Animated GIFs are preserved (all frames are read and written back).
* **`svg`** uses svgo's `preset-default`. svgo v4 keeps `viewBox` by default (so scaling is preserved); `cleanupIds` is disabled to avoid breaking inlined/scripted/externally-referenced SVGs; `removeDesc` is disabled to preserve accessibility metadata.
* **`resize`** is `null` (disabled) to preserve image dimensions by default. Provide a sharp resize options object to cap dimensions; using `withoutEnlargement: true` is recommended so smaller images are not upscaled.

### Behaviour

* If no configuration file is found, all defaults above are used.
* If a key is missing, that format uses its built-in default.
* If a key is present, its value **replaces** the built-in default for that format. The configuration is **not** deep-merged.
* The format is detected from the file content (and the extension for SVG), so the file extension does not have to match the real format.
* Unsupported formats are skipped silently, which makes a broad lint-staged glob safe.
* A file is only rewritten when the optimised result is strictly smaller than the original.

## Trade-offs and known differences

Because sharp re-encodes raster images rather than performing the byte-level lossless transforms that `jpegtran`/`optipng`/`gifsicle` did, there are intentional behavioural differences from `imagemin-lint-staged`. These are tracked in [ToDo.md](ToDo.md):

* **JPEG is lossy.** sharp has no lossless JPEG optimiser equivalent to `jpegtran`. The "strictly smaller" write guard keeps repeated commits from snowballing quality loss, but the first optimisation of a JPEG is a re-encode.
* **PNG/GIF are lossless by default** and effectively idempotent thanks to the write guard.
* **SVG** is handled by svgo, matching the previous behaviour.

## Migrating from imagemin-lint-staged

1. Replace the dependency:

   ```sh
   npm rm @davidsneighbour/imagemin-lint-staged
   npm i -D @davidsneighbour/sharp-lint-staged
   ```

2. Update the lint-staged command from `imagemin-lint-staged` to `sharp-lint-staged`.
3. Rename any config file/key from `imagemin-lint-staged` to `sharp-lint-staged`. The config shape changed: `gifsicle`/`jpegtran`/`optipng` become `gif`/`jpeg`/`png` (sharp options), while `svgo` becomes `svg` (svgo options).

## Contributing

1. Fork it
2. Create your feature branch (`git checkout -b my-new-feature`)
3. Commit your changes (`git commit -am 'Add some feature'`)
4. Push to the branch (`git push origin my-new-feature`)
5. Create a new Pull Request

## Development

```sh
npm install     # install dependencies
npm run build   # compile TypeScript from src/ to dist/
npm test        # run the vitest suite against real fixtures
```

[lint-staged]: https://github.com/lint-staged/lint-staged
[cosmiconfig]: https://github.com/cosmiconfig/cosmiconfig
[npm-image]: https://img.shields.io/npm/v/@davidsneighbour/sharp-lint-staged.svg?style=flat-square
[npm-url]: https://www.npmjs.org/package/@davidsneighbour/sharp-lint-staged
[github-workflows-pr-image]: https://github.com/davidsneighbour/sharp-lint-staged/actions/workflows/pr.yml/badge.svg
[github-workflows-pr-url]: https://github.com/davidsneighbour/sharp-lint-staged/actions/workflows/pr.yml
