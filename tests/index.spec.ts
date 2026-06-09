import { cp, mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { defaultConfig, getFormatConfig, optimizeFile } from '../src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FIXTURE_DIR = path.resolve(__dirname, '__fixtures__');

const RASTER_FIXTURES = [
  { filename: 'test.jpg', format: 'jpeg' },
  { filename: 'test.png', format: 'png' },
  { filename: 'test.gif', format: 'gif' },
] as const;

let tempDir: string;

const stage = async (filename: string): Promise<string> => {
  const target = path.join(tempDir, filename);
  await cp(path.join(FIXTURE_DIR, filename), target);

  return target;
};

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), 'sharp-lint-staged-test-'));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe('optimizeFile', () => {
  it.each(RASTER_FIXTURES)(
    'optimises $filename in place and keeps it a valid $format image',
    async ({ filename, format }) => {
      const target = await stage(filename);

      const before = (await stat(target)).size;
      const beforeMeta = await sharp(await readFile(target), { animated: true }).metadata();

      const changed = await optimizeFile(target);

      const after = (await stat(target)).size;
      const afterMeta = await sharp(await readFile(target), { animated: true }).metadata();

      expect(changed).toBe(true);
      expect(after).toBeLessThan(before);
      expect(afterMeta.format).toBe(format);
      expect(afterMeta.width).toBe(beforeMeta.width);
      expect(afterMeta.height).toBe(beforeMeta.height);
    },
  );

  it('optimises test.svg in place and keeps valid SVG markup', async () => {
    const target = await stage('test.svg');

    const before = (await stat(target)).size;

    const changed = await optimizeFile(target);

    const after = await readFile(target, 'utf8');

    expect(changed).toBe(true);
    expect((await stat(target)).size).toBeLessThan(before);
    expect(after).toContain('<svg');
    // viewBox is preserved by the default svgo configuration.
    expect(after).toContain('viewBox');
  });

  it('is idempotent: a second run does not shrink an already-optimised file', async () => {
    const target = await stage('test.png');

    await optimizeFile(target);
    const optimisedSize = (await stat(target)).size;

    const changedAgain = await optimizeFile(target);

    expect(changedAgain).toBe(false);
    expect((await stat(target)).size).toBe(optimisedSize);
  });

  it('skips unsupported formats without throwing', async () => {
    const target = path.join(tempDir, 'notes.txt');
    await cp(path.join(FIXTURE_DIR, 'test.svg'), target); // arbitrary bytes, non-image extension

    const changed = await optimizeFile(target);

    expect(changed).toBe(false);
  });
});

describe('getFormatConfig', () => {
  it('returns the built-in default when no user config is present', () => {
    expect(getFormatConfig({}, 'png')).toEqual(defaultConfig.png);
  });

  it('returns the user config when present, without deep-merging', () => {
    const userPng = { compressionLevel: 6 };
    expect(getFormatConfig({ png: userPng }, 'png')).toBe(userPng);
  });
});
