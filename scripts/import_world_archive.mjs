#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';

function fail(message) {
  console.error(message);
  process.exit(1);
}

const [archiveArg] = process.argv.slice(2);

if (!archiveArg) {
  fail('Usage: npm run import:world-archive -- <path-to-renations-world-archive.json>');
}

const repoRoot = process.cwd();
const archivePath = path.resolve(repoRoot, archiveArg);
const worldDataRoot = path.resolve(repoRoot, 'src/game/world/data');

let archive;

try {
  const raw = await fs.readFile(archivePath, 'utf8');
  archive = JSON.parse(raw);
} catch (error) {
  fail(`Failed to read archive: ${error instanceof Error ? error.message : 'Unknown error.'}`);
}

if (archive?.format !== 'renations-world-archive-v1' || typeof archive.files !== 'object' || archive.files === null) {
  fail('Archive format is invalid. Expected renations-world-archive-v1 with a files object.');
}

const entries = Object.entries(archive.files);

if (entries.length === 0) {
  fail('Archive does not contain any files.');
}

for (const [relativePath, contents] of entries) {
  if (typeof relativePath !== 'string' || !relativePath.startsWith('src/game/world/data/')) {
    fail(`Archive contains an unsupported target path: ${relativePath}`);
  }

  const outputPath = path.resolve(repoRoot, relativePath);

  if (!outputPath.startsWith(worldDataRoot + path.sep) && outputPath !== path.join(worldDataRoot, 'overworld.world.json')) {
    fail(`Archive path escapes the world data directory: ${relativePath}`);
  }

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(contents, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${relativePath}`);
}

console.log(`Imported ${entries.length} world file${entries.length === 1 ? '' : 's'} from ${path.relative(repoRoot, archivePath)}.`);
