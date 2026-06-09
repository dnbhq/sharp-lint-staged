#!/usr/bin/env node
import { optimizeFile } from './index.js';

const files = process.argv.slice(2);

Promise.all(files.map(optimizeFile)).catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
