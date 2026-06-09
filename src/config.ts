import { cosmiconfig } from 'cosmiconfig';
import type sharp from 'sharp';
import type { Config as SvgoConfig } from 'svgo';

/**
 * Optional resize configuration. When set, it is forwarded to
 * {@link https://sharp.pixelplumbing.com/api-resize | sharp's resize() method}
 * before the image is re-encoded. Set to `null` (the default) to keep the
 * original dimensions.
 */
export type ResizeConfig = (sharp.ResizeOptions & { width?: number; height?: number }) | null;

/**
 * Full configuration object for sharp-lint-staged.
 *
 * Each raster key is passed verbatim to the matching sharp output method, and
 * the `svg` key is passed to svgo. Any key that is omitted falls back to the
 * built-in default for that format.
 */
export interface SharpLintStagedConfig {
  jpeg?: sharp.JpegOptions;
  png?: sharp.PngOptions;
  gif?: sharp.GifOptions;
  svg?: SvgoConfig;
  resize?: ResizeConfig;
}

/**
 * Built-in defaults.
 *
 * Raster defaults favour the strongest lossless encoder effort available in
 * sharp while keeping JPEG re-encoding visually close to the source. SVG
 * optimisation mirrors the lossless, accessibility-friendly preset used by the
 * predecessor imagemin-lint-staged package.
 */
export const defaultConfig = {
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
          overrides: {
            // svgo v4 keeps `viewBox` by default (removeViewBox is no longer
            // part of preset-default), so only the remaining safety overrides
            // are needed here.
            cleanupIds: false,
            removeDesc: false,
          },
        },
      },
    ],
  },
  resize: null,
} satisfies Required<SharpLintStagedConfig>;

const explorer = cosmiconfig('sharp-lint-staged');

let configPromise: Promise<SharpLintStagedConfig> | undefined;

/**
 * Loads the project configuration through cosmiconfig.
 *
 * The search is performed once and cached for the lifetime of the process, so
 * optimising many files in a single CLI invocation only reads the config once.
 *
 * @returns The resolved user configuration, or an empty object when none is found.
 */
export const loadConfig = async (): Promise<SharpLintStagedConfig> => {
  configPromise ??= explorer.search().then((result) => result?.config ?? {});

  return configPromise;
};

/**
 * Returns the configuration for a single format, falling back to the built-in
 * default when the user has not provided that key. Configuration is not
 * deep-merged: a present key fully replaces the default for that format.
 *
 * @param config - The resolved user configuration.
 * @param key - The format key to read.
 * @returns The effective configuration for that format.
 */
export const getFormatConfig = <K extends keyof typeof defaultConfig>(
  config: SharpLintStagedConfig,
  key: K,
): (typeof defaultConfig)[K] => {
  const value = config[key];

  return (value ?? defaultConfig[key]) as (typeof defaultConfig)[K];
};
