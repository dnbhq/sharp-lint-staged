import { readFile, writeFile } from 'node:fs/promises';

import sharp from 'sharp';
import { optimize as svgoOptimize } from 'svgo';

import {
  defaultConfig,
  getFormatConfig,
  loadConfig,
  type ResizeConfig,
  type SharpLintStagedConfig,
} from './config.js';

export {
  defaultConfig,
  getFormatConfig,
  loadConfig,
  type ResizeConfig,
  type SharpLintStagedConfig,
} from './config.js';

const SVG_EXTENSION = /\.svg$/i;

/** Raster formats that sharp can both read and write through this package. */
type RasterFormat = 'jpeg' | 'png' | 'gif';

const SUPPORTED_RASTER_FORMATS = new Set<RasterFormat>(['jpeg', 'png', 'gif']);

const isRasterFormat = (format: string | undefined): format is RasterFormat =>
  format !== undefined && SUPPORTED_RASTER_FORMATS.has(format as RasterFormat);

/**
 * Optimises a single SVG file in place using svgo.
 *
 * @param filename - Path to the SVG file.
 * @param config - The resolved user configuration.
 * @returns `true` when the file was rewritten with a smaller result.
 */
const optimizeSvg = async (
  filename: string,
  config: SharpLintStagedConfig,
): Promise<boolean> => {
  const input = await readFile(filename, 'utf8');
  const svgConfig = getFormatConfig(config, 'svg');

  const result = svgoOptimize(input, { path: filename, ...svgConfig });

  if (Buffer.byteLength(result.data) < Buffer.byteLength(input)) {
    await writeFile(filename, result.data, 'utf8');

    return true;
  }

  return false;
};

/**
 * Optimises a single raster file (JPEG, PNG or GIF) in place using sharp.
 *
 * Animated input is preserved, an optional resize is applied, and the result is
 * only written back when it is strictly smaller than the original. Keeping the
 * smaller of the two buffers avoids growing already-optimised images and makes
 * repeated runs converge to a stable file.
 *
 * @param filename - Path to the raster image file.
 * @param config - The resolved user configuration.
 * @returns `true` when the file was rewritten with a smaller result.
 */
const optimizeRaster = async (
  filename: string,
  config: SharpLintStagedConfig,
): Promise<boolean> => {
  const input = await readFile(filename);

  let pipeline = sharp(input, { animated: true });
  const { format } = await pipeline.metadata();

  if (!isRasterFormat(format)) {
    return false;
  }

  const resize: ResizeConfig = config.resize ?? defaultConfig.resize;
  if (resize) {
    pipeline = pipeline.resize(resize);
  }

  switch (format) {
    case 'jpeg':
      pipeline = pipeline.jpeg(getFormatConfig(config, 'jpeg'));
      break;
    case 'png':
      pipeline = pipeline.png(getFormatConfig(config, 'png'));
      break;
    case 'gif':
      pipeline = pipeline.gif(getFormatConfig(config, 'gif'));
      break;
  }

  const output = await pipeline.toBuffer();

  if (output.length < input.length) {
    await writeFile(filename, output);

    return true;
  }

  return false;
};

/**
 * Optimises a single image file in place.
 *
 * The format is chosen from the file's content (or extension for SVG), so the
 * caller can pass any of the supported file types. Unsupported formats are
 * skipped silently, which makes this safe to wire into a broad lint-staged glob.
 *
 * @param filename - Path to the image file to optimise.
 * @returns `true` when the file was rewritten with a smaller result, otherwise `false`.
 */
export const optimizeFile = async (filename: string): Promise<boolean> => {
  const config = await loadConfig();

  if (SVG_EXTENSION.test(filename)) {
    return optimizeSvg(filename, config);
  }

  return optimizeRaster(filename, config);
};
