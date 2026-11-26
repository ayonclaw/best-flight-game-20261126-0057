// main.ts — Kestrel Run's hand-in program.
//
// This is the entrypoint the bounty grader actually runs. It packs this
// repository's entry: it stages the playable game (game/) and its rendered
// stills (screenshots/) into the hand-in directory, then asks the vendored
// make.fun library to build the dossier the judge reads, and saves it there.
//
// The hand-in directory comes from MAKEFUN_OUTPUT_DIR (the grader sets it to
// its output mount; outside the container you can point it anywhere):
//
//   MAKEFUN_OUTPUT_DIR=out node main.ts
//
// Run from the repository root with stock Node 22 — no flags, no build, no
// install. The game is plain static files a desktop browser loads offline.

import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier, type DossierCaps } from './vendor/makefun-game.ts';

// Where main.ts lives (import.meta.url is file:///..., dirname drops the file).
const PROJECT_DIR = dirname(fileURLToPath(import.meta.url));

// Where the entry is handed in; /output is what the grader mounts.
const OUTPUT_ROOT = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The limits the platform's grader enforces (its gate.json), passed straight
// through to buildDossier so a duplicate entry gets refused exactly where the
// scorer would refuse it. Only text_max_bytes shapes the dossier's bytes; the
// rest are hard refusals that cost nothing to obey.
const GATE_LIMITS: DossierCaps = {
  text_max_bytes: 163840, // how much source text the dossier may hold
  screenshots: { max: 4, max_bytes: 262144 }, // 4 images, each at most 256 KiB
  game_max_files: 993, // leaves room for screenshots/, its files and the dossier
  game_max_bytes: 50331648, // 48 MiB of game files, all told
  game_path_max_bytes: 1000, // the platform's 1024-byte path, less 'game/'
};

// --------------------------------------------------------------------- small helpers

/** The thousands-separated form of a number, for the summary only. */
function pretty(n: number): string {
  return n.toLocaleString('en-US');
}

/** Removes `dir` if it exists and recreates it empty. */
function freshDirectory(dir: string): void {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
}

/** Walks a directory tree counting its files and their total bytes. */
function inventory(dir: string): { files: number; bytes: number } {
  let files = 0;
  let bytes = 0;
  const walk = (here: string): void => {
    for (const entry of readdirSync(here, { withFileTypes: true })) {
      const path = join(here, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile()) {
        files++;
        bytes += statSync(path).size;
      }
    }
  };
  walk(dir);
  return { files, bytes };
}

/** The hex digest of a file's contents, for the summary. */
function sha256Of(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

// --------------------------------------------------------------------- the hand-in

/**
 * Stages one named folder from beside main.ts into the output root: the target
 * gets a fresh empty directory first (so reruns never pick up stale files),
 * then the source tree is copied over. Returns what now sits in the output.
 */
function stageFolder(name: 'game' | 'screenshots'): { files: number; bytes: number } {
  const sourceDir = join(PROJECT_DIR, name);
  const targetDir = join(OUTPUT_ROOT, name);
  freshDirectory(targetDir);
  if (!existsSync(sourceDir)) {
    if (name === 'game') throw new Error(`entry incomplete: ./${name}/ is missing beside main.ts`);
    return { files: 0, bytes: 0 };
  }
  cpSync(sourceDir, targetDir, { recursive: true });
  return inventory(targetDir);
}

// 1. Make sure the hand-in root exists, whatever the grader set it to.
mkdirSync(OUTPUT_ROOT, { recursive: true });

// 2. Copy the game in (required) and the screenshots in (the dossier's covers;
//    staged even when absent so buildDossier refuses the entry with its own error).
const game = stageFolder('game');
const shots = stageFolder('screenshots');

// 3. Let the vendored library read the staged tree and write the dossier the
//    judge reads, bounded by the platform's own caps.
const dossierBytes = buildDossier(OUTPUT_ROOT, GATE_LIMITS);
writeFileSync(join(OUTPUT_ROOT, 'dossier.json'), dossierBytes);

// --------------------------------------------------------------------- the summary

const dossierPath = join(OUTPUT_ROOT, 'dossier.json');
const dossierText = JSON.parse(readFileSync(dossierPath, 'utf8')).text as string;
const textBytes = Buffer.byteLength(dossierText, 'utf8');
console.log('Kestrel Run hand-in complete');
console.log(`  output dir   ${OUTPUT_ROOT}`);
console.log(`  game         ${pretty(game.files)} files, ${pretty(game.bytes)} bytes`);
console.log(`  screenshots  ${pretty(shots.files)} files, ${pretty(shots.bytes)} bytes`);
console.log(`  dossier      ${pretty(dossierBytes.length)} bytes at ${dossierPath}`);
console.log(`  dossier sha256 ${sha256Of(dossierPath)}`);
console.log(`  source text  ${pretty(textBytes)} bytes of the ${pretty(GATE_LIMITS.text_max_bytes)} cap (${(textBytes / GATE_LIMITS.text_max_bytes * 100).toFixed(1)}% used)`);
