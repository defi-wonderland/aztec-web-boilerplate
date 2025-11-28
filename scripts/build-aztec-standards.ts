/* eslint-disable no-console */
// Run with: tsx scripts/build-aztec-standards.ts [commit-or-tag]
// This script builds @defi-wonderland/aztec-standards from the specified commit/tag
// and stores artifacts in ARTIFACTS_OUTPUT_DIR and target in TARGET_OUTPUT_DIR

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Wonderland Aztec Standards repository
const REPO = 'https://github.com/defi-wonderland/aztec-standards.git';
// Output directory for artifacts in the current repository (NOT Aztec Standards)
const ARTIFACTS_OUTPUT_DIR = 'src/artifacts';
// Output directory for target in the current repository (NOT Aztec Standards)
const TARGET_OUTPUT_DIR = 'target';

/**
 * Run a command
 */
function run(cmd: string, opts: Record<string, any> = {}) {
  const res = spawnSync(cmd, { stdio: 'inherit', shell: true, ...opts });
  if (res.status !== 0) {
    throw new Error(`Command failed (${res.status}): ${cmd}`);
  }
}

/**
 * Try to run a command
 */
function tryRun(cmd: string, opts: Record<string, any> = {}) {
  try {
    const res = spawnSync(cmd, { stdio: 'inherit', shell: true, ...opts });
    return res.status === 0;
  } catch {
    return false;
  }
}

/**
 * Ensure a directory exists
 */
function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}

/**
 * Copy a file or directory
 */
function cp(src: string, dst: string) {
  if (!fs.existsSync(src)) return;
  ensureDir(path.dirname(dst));
  fs.cpSync(src, dst, { recursive: true });
}

/**
 * Read a JSON file
 */
function readJSON<T = any>(file: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
  } catch {
    return null;
  }
}

/**
 * Detect the preferred package manager for a repository
 */
function detectPackageManager(repoDir: string): string {
  const pkgJson = readJSON<{ packageManager?: string }>(path.join(repoDir, 'package.json'));

  if (pkgJson?.packageManager) {
    // Extract package manager from packageManager field (e.g., "yarn@1.22.22" -> "yarn")
    const pm = pkgJson.packageManager.split('@')[0];
    console.log(`📦 Detected package manager from package.json: ${pm}`);
    return pm;
  }

  // Check for lockfiles
  if (fs.existsSync(path.join(repoDir, 'yarn.lock'))) {
    console.log(' Detected package manager from lockfile: yarn');
    return 'yarn';
  }
  if (fs.existsSync(path.join(repoDir, 'pnpm-lock.yaml'))) {
    console.log(' Detected package manager from lockfile: pnpm');
    return 'pnpm';
  }
  if (fs.existsSync(path.join(repoDir, 'package-lock.json'))) {
    console.log('📦 Detected package manager from lockfile: npm');
    return 'npm';
  }

  // Default to npm
  console.log(' No package manager detected, defaulting to npm');
  return 'npm';
}

/**
 * Run a command with the appropriate package manager
 */
function runWithPackageManager(repoDir: string, command: string): boolean {
  const pm = detectPackageManager(repoDir);
  switch (pm) {
    case 'yarn':
      return tryRun(`cd "${repoDir}" && yarn ${command}`);
    case 'pnpm':
      return tryRun(`cd "${repoDir}" && pnpm ${command}`);
    case 'npm':
    default:
      return tryRun(`cd "${repoDir}" && npm run ${command}`);
  }
}

/**
 * Install dependencies with the appropriate package manager
 */
function installDependencies(repoDir: string): boolean {
  const pm = detectPackageManager(repoDir);
  switch (pm) {
    case 'yarn':
      return tryRun(`cd "${repoDir}" && yarn install --no-audit --no-fund`);
    case 'pnpm':
      return tryRun(`cd "${repoDir}" && pnpm install --no-audit --no-fund`);
    case 'npm':
    default:
      return tryRun(`cd "${repoDir}" && npm install --no-audit --no-fund`);
  }
}

/**
 * Run aztec codegen
 */
function runCodegen(repoDir: string): boolean {
  console.log('🔧 Running aztec codegen...');

  const command = `cd "${repoDir}" && aztec codegen target --outdir ${ARTIFACTS_OUTPUT_DIR} --force`;
  console.log(`🔧 Running: ${command}`);

  if (tryRun(command)) {
    console.log('✅ Codegen completed successfully');
    return true;
  }

  console.error('❌ All codegen approaches failed');
  return false;
}

/**
 * Copy files without overwriting existing ones
 */
function copyFiles(sourceDir: string, targetDir: string, forceOverwrite = false): number {
  if (!fs.existsSync(sourceDir)) {
    console.log(`⚠️ Source directory ${sourceDir} does not exist`);
    return 0;
  }

  ensureDir(targetDir);
  const files = fs.readdirSync(sourceDir);
  let copiedCount = 0;
  let skippedCount = 0;

  for (const file of files) {
    // Only copy files that contain "Dripper" in the filename
    if (!file.includes('Dripper') && !file.includes('Token')) {
      continue;
    }

    const srcPath = path.join(sourceDir, file);
    const dstPath = path.join(targetDir, file);

    if (fs.existsSync(dstPath) && !forceOverwrite) {
      console.log(`⏭️ Skipping ${file} (already exists)`);
      skippedCount++;
      continue;
    }
    // Overwrite or copy new
    if (fs.statSync(srcPath).isDirectory()) {
      fs.cpSync(srcPath, dstPath, { recursive: true, force: true });
    } else {
      fs.copyFileSync(srcPath, dstPath);
    }
    copiedCount++;
  }

  console.log(`✅ Copied ${copiedCount} items, skipped ${skippedCount} existing items`);
  return copiedCount;
}

async function main() {
  // Args: <commit-or-tag> [--force]
  const commitOrTag = process.argv[2];
  const forceOverwrite = process.argv.includes('--force');

  if (!commitOrTag) {
    console.error('❌ Please provide a commit or tag as the first argument');
    console.error('Usage: tsx scripts/build-aztec-standards.ts <commit-or-tag>');
    process.exit(1);
  }

  try {
    // 1) Temp clone and install dev deps - ensure temp dir is within user home
    const userHome = os.homedir();
    const tmp = fs.mkdtempSync(path.join(userHome, '.aztec-standards-build-'));
    const repoDir = path.join(tmp, 'repo');

    try {
      console.log(`\n🔨 Building aztec-standards from ${REPO} @ ${commitOrTag}`);
      console.log(` Using temp directory: ${tmp}`);
      run(`git clone ${REPO} "${repoDir}" --quiet`);
      run(`git -C "${repoDir}" checkout ${commitOrTag} --quiet`);

      // Install dependencies using detected package manager
      if (!installDependencies(repoDir)) {
        console.warn('⚠️ Primary package manager install failed, trying npm as fallback');
        run(`cd "${repoDir}" && npm install --no-audit --no-fund`);
      }

      // 2) Load the package.json
      const pkgJson = readJSON<{
        scripts?: Record<string, string>;
        config?: any;
      }>(path.join(repoDir, 'package.json'));

      // 3) Compile sources if repo exposes a compile script
      if (pkgJson?.scripts?.compile) {
        if (!runWithPackageManager(repoDir, 'compile')) {
          throw new Error(`Failed to compile with detected package manager: ${detectPackageManager(repoDir)}`);
        }
      }

      // 4) Codegen - assume sandbox is running
      ensureDir(path.join(repoDir, ARTIFACTS_OUTPUT_DIR));

      try {
        if (!runCodegen(repoDir)) {
          throw new Error('All codegen approaches failed');
        }
      } catch (error) {
        console.error('❌ Codegen failed:', error);
        throw error;
      }

      // 5) Copy artifacts to ARTIFACTS_OUTPUT_DIR (without overwriting)
      const targetArtifactsDir = path.join(process.cwd(), ARTIFACTS_OUTPUT_DIR);
      console.log(`\n📁 Copying artifacts to: ${targetArtifactsDir}`);
      copyFiles(path.join(repoDir, ARTIFACTS_OUTPUT_DIR), targetArtifactsDir, forceOverwrite);

      // 6) Copy target to TARGET_OUTPUT_DIR (without overwriting)
      const targetTargetDir = path.join(process.cwd(), TARGET_OUTPUT_DIR);
      console.log(`\n📁 Copying target to: ${targetTargetDir}`);
      copyFiles(path.join(repoDir, TARGET_OUTPUT_DIR), targetTargetDir, forceOverwrite);

      console.log('\n✅ aztec-standards artifacts and target built and stored successfully.');
    } catch (err: any) {
      console.error('\n❌ Build script failed:', err?.message || err);
      process.exit(1);
    } finally {
      // cleanup temp directory
      try {
        fs.rmSync(tmp, { recursive: true, force: true });
      } catch {}
    }
  } catch (err: any) {
    console.error('\n❌ Build script failed:', err?.message || err);
    process.exit(1);
  }
}

main();