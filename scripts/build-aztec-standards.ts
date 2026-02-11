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
// This project stores compiled JSONs in src/target/ (wrappers import from ../target/)
const TARGET_OUTPUT_DIR = 'src/target';

/**
 * Run a command
 */
function run(cmd: string, opts: Record<string, unknown> = {}) {
  const res = spawnSync(cmd, { stdio: 'inherit', shell: true, ...opts });
  if (res.status !== 0) {
    throw new Error(`Command failed (${res.status}): ${cmd}`);
  }
}

/**
 * Try to run a command
 */
function tryRun(cmd: string, opts: Record<string, unknown> = {}) {
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
 * Read a JSON file
 */
function readJSON<T = unknown>(file: string): T | null {
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
  const pkgJson = readJSON<{ packageManager?: string }>(
    path.join(repoDir, 'package.json')
  );

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
 * Run aztec codegen.
 * Reads compiled JSONs from src/target/ (after we copy them from target/)
 * so that generated wrappers import from ../target/ which resolves correctly
 * in this project's structure (src/artifacts/ → src/target/).
 */
function runCodegen(repoDir: string): boolean {
  console.log('🔧 Running aztec codegen...');

  // Copy compiled JSONs from target/ to src/target/ so codegen generates
  // relative imports that match our project structure (../target/ from src/artifacts/)
  const compileOutput = path.join(repoDir, 'target');
  const codegenInput = path.join(repoDir, TARGET_OUTPUT_DIR);
  ensureDir(codegenInput);

  if (fs.existsSync(compileOutput)) {
    const files = fs.readdirSync(compileOutput);
    for (const file of files) {
      if (file.endsWith('.json')) {
        fs.copyFileSync(
          path.join(compileOutput, file),
          path.join(codegenInput, file)
        );
      }
    }
    console.log(
      `   Copied compiled JSONs from target/ to ${TARGET_OUTPUT_DIR}/`
    );
  }

  const command = `cd "${repoDir}" && aztec codegen ${TARGET_OUTPUT_DIR} --outdir ${ARTIFACTS_OUTPUT_DIR} --force`;
  console.log(`🔧 Running: ${command}`);

  if (tryRun(command)) {
    console.log('✅ Codegen completed successfully');
    return true;
  }

  console.error('❌ Codegen failed');
  return false;
}

/**
 * Copy files without overwriting existing ones
 */
function copyFiles(
  sourceDir: string,
  targetDir: string,
  forceOverwrite = false
): number {
  if (!fs.existsSync(sourceDir)) {
    console.log(`⚠️ Source directory ${sourceDir} does not exist`);
    return 0;
  }

  ensureDir(targetDir);
  const files = fs.readdirSync(sourceDir);
  let copiedCount = 0;
  let skippedCount = 0;

  for (const file of files) {
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

  console.log(
    `✅ Copied ${copiedCount} items, skipped ${skippedCount} existing items`
  );
  return copiedCount;
}

/**
 * Strip the __aztec_nr_internals__ prefix from function names in compiled artifact JSONs.
 * Replicates the Docker-only strip_aztec_nr_prefix.sh script.
 */
function stripAztecNrPrefix(targetDir: string): void {
  if (!fs.existsSync(targetDir)) return;

  const PREFIX = '__aztec_nr_internals__';
  const jsonFiles = fs
    .readdirSync(targetDir)
    .filter((f) => f.endsWith('.json'));

  for (const file of jsonFiles) {
    const filePath = path.join(targetDir, file);
    const artifact = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    if (!Array.isArray(artifact.functions)) continue;

    let modified = false;
    for (const fn of artifact.functions) {
      if (typeof fn.name === 'string' && fn.name.startsWith(PREFIX)) {
        fn.name = fn.name.slice(PREFIX.length);
        modified = true;
      }
    }

    if (modified) {
      fs.writeFileSync(filePath, JSON.stringify(artifact));
      console.log(`   🔧 Stripped __aztec_nr_internals__ prefix from ${file}`);
    }
  }
}

async function main() {
  // Args: <commit-or-tag> [--force]
  const commitOrTag = process.argv[2];
  const forceOverwrite = process.argv.includes('--force');

  if (!commitOrTag) {
    console.error('❌ Please provide a commit or tag as the first argument');
    console.error(
      'Usage: tsx scripts/build-aztec-standards.ts <commit-or-tag>'
    );
    process.exit(1);
  }

  try {
    // 1) Temp clone and install dev deps - ensure temp dir is within user home
    const userHome = os.homedir();
    const tmp = fs.mkdtempSync(path.join(userHome, '.aztec-standards-build-'));
    const repoDir = path.join(tmp, 'repo');

    try {
      console.log(
        `\n🔨 Building aztec-standards from ${REPO} @ ${commitOrTag}`
      );
      console.log(` Using temp directory: ${tmp}`);
      run(`git clone ${REPO} "${repoDir}" --quiet`);
      run(`git -C "${repoDir}" checkout ${commitOrTag} --quiet`);

      // Install dependencies using detected package manager
      if (!installDependencies(repoDir)) {
        console.warn(
          '⚠️ Primary package manager install failed, trying npm as fallback'
        );
        run(`cd "${repoDir}" && npm install --no-audit --no-fund`);
      }

      // 2) Compile sources: run `aztec compile` directly instead of the
      //    repo's compile script, which may include post-processing steps
      //    that reference Docker-internal paths (e.g. strip_aztec_nr_prefix.sh)
      console.log('\n🔨 Compiling contracts...');
      if (!tryRun(`cd "${repoDir}" && aztec compile`)) {
        // Check if compilation partially succeeded (target/*.json files exist)
        const targetDir = path.join(repoDir, 'target');
        const hasArtifacts =
          fs.existsSync(targetDir) &&
          fs.readdirSync(targetDir).some((f) => f.endsWith('.json'));
        if (hasArtifacts) {
          console.warn(
            '⚠️ Compile command exited with error but artifacts were generated, continuing...'
          );
        } else {
          throw new Error('Compilation failed and no artifacts were generated');
        }
      }

      // 3) Strip __aztec_nr_internals__ prefix from function names in artifact JSONs.
      //    This replicates what strip_aztec_nr_prefix.sh (Docker-only) does.
      //    Without this, v4 SDK can't find 'constructor' (it's named __aztec_nr_internals__constructor).
      stripAztecNrPrefix(path.join(repoDir, 'target'));

      // 4) Codegen - copies target/ → src/target/ then generates wrappers
      ensureDir(path.join(repoDir, ARTIFACTS_OUTPUT_DIR));

      try {
        if (!runCodegen(repoDir)) {
          throw new Error('Codegen failed');
        }
      } catch (error) {
        console.error('❌ Codegen failed:', error);
        throw error;
      }

      // 5) Copy artifacts to ARTIFACTS_OUTPUT_DIR
      const targetArtifactsDir = path.join(process.cwd(), ARTIFACTS_OUTPUT_DIR);
      console.log(`\n📁 Copying artifacts to: ${targetArtifactsDir}`);
      copyFiles(
        path.join(repoDir, ARTIFACTS_OUTPUT_DIR),
        targetArtifactsDir,
        forceOverwrite
      );

      // 6) Copy target JSONs to TARGET_OUTPUT_DIR (src/target/)
      const targetTargetDir = path.join(process.cwd(), TARGET_OUTPUT_DIR);
      console.log(`\n📁 Copying target to: ${targetTargetDir}`);
      copyFiles(
        path.join(repoDir, TARGET_OUTPUT_DIR),
        targetTargetDir,
        forceOverwrite
      );

      console.log(
        '\n✅ aztec-standards artifacts and target built and stored successfully.'
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('\n❌ Build script failed:', msg);
      process.exit(1);
    } finally {
      // cleanup temp directory
      try {
        fs.rmSync(tmp, { recursive: true, force: true });
      } catch {
        // ignore cleanup errors
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('\n❌ Build script failed:', msg);
    process.exit(1);
  }
}

main();
