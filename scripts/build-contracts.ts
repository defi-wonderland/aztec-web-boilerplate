// Run with: tsx scripts/build-contracts.ts [--force]
// This script copies artifacts from @defi-wonderland/aztec-standards and compiles local contracts

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

// Output directory for artifacts (TypeScript wrappers)
const ARTIFACTS_OUTPUT_DIR = 'src/artifacts';
// NPM package path — used to remove stale v3 artifacts before compiling
const NPM_PACKAGE_PATH = 'node_modules/@defi-wonderland/aztec-standards';

/**
 * Try to run a command
 */
function tryRun(cmd: string, opts: Record<string, unknown> = {}): boolean {
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
function ensureDir(p: string): void {
  fs.mkdirSync(p, { recursive: true });
}

/**
 * Copy files with optional filter
 */
function copyFiles(
  sourceDir: string,
  targetDir: string,
  forceOverwrite = false,
  filter?: (file: string) => boolean
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
    // Apply filter if provided
    if (filter && !filter(file)) {
      continue;
    }

    const srcPath = path.join(sourceDir, file);
    const dstPath = path.join(targetDir, file);

    if (fs.existsSync(dstPath) && !forceOverwrite) {
      console.log(`   ⏭️ Skipping ${file} (already exists)`);
      skippedCount++;
      continue;
    }

    // Overwrite or copy new
    if (fs.statSync(srcPath).isDirectory()) {
      fs.cpSync(srcPath, dstPath, { recursive: true, force: true });
    } else {
      fs.copyFileSync(srcPath, dstPath);
    }
    console.log(`   ✅ Copied ${file}`);
    copiedCount++;
  }

  console.log(
    `   📊 Copied ${copiedCount} items, skipped ${skippedCount} existing items`
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

/**
 * Compile local contracts using workspace Nargo.toml at root level
 */
function compileLocalContracts(
  projectRoot: string,
  forceOverwrite: boolean
): boolean {
  const workspaceNargo = path.join(projectRoot, 'Nargo.toml');

  if (!fs.existsSync(workspaceNargo)) {
    console.error(`❌ No workspace Nargo.toml found at ${projectRoot}`);
    return false;
  }

  console.log('\n🔨 Compiling contracts from workspace...');

  // Remove stale v3 artifacts from node_modules that crash the v4 barretenberg
  // post-processor (aztec compile scans all JSON artifacts recursively)
  const staleTargetDir = path.join(projectRoot, NPM_PACKAGE_PATH, 'target');
  if (fs.existsSync(staleTargetDir)) {
    fs.rmSync(staleTargetDir, { recursive: true, force: true });
    console.log(
      '   🗑️ Removed stale artifacts from node_modules aztec-standards'
    );
  }

  // Compile all contracts from workspace root
  // Note: In v4, compilation is done via aztec-nargo (nargo inside Docker).
  // aztec compile was removed — use aztec-nargo compile instead.
  tryRun(`cd "${projectRoot}" && aztec-nargo compile`);
  const compiledTarget = path.join(projectRoot, 'target');
  const hasArtifacts =
    fs.existsSync(compiledTarget) &&
    fs.readdirSync(compiledTarget).some((f) => f.endsWith('.json'));
  if (!hasArtifacts) {
    console.error('   ❌ Failed to compile contracts — no artifacts generated');
    return false;
  }

  console.log('   ✅ Contracts compiled successfully');

  // Strip __aztec_nr_internals__ prefix from function names (replicates Docker-only script)
  stripAztecNrPrefix(compiledTarget);

  // TODO: This might not be needed because `yarn codegen` takes care of using a path relative to the target/
  // Copy artifacts from target/ to src/artifacts/
  const targetDir = path.join(projectRoot, 'target');
  const artifactsDir = path.join(projectRoot, ARTIFACTS_OUTPUT_DIR);

  if (fs.existsSync(targetDir)) {
    copyFiles(
      targetDir,
      artifactsDir,
      forceOverwrite,
      (file) => file.endsWith('.json') && !file.endsWith('.bak')
    );
  }

  return true;
}

async function main() {
  const forceOverwrite = process.argv.includes('--force');
  const projectRoot = process.cwd();

  console.log(`
╔════════════════════════════════════════════════════════════════╗
║           BUILD CONTRACTS                                      ║
╚════════════════════════════════════════════════════════════════╝
`);

  try {
    // 1) aztec-standards artifacts are built by build-aztec-standards.ts
    //    (invoked via `yarn build-standards` before this script)
    console.log('='.repeat(60));
    console.log(
      '📦 Step 1: aztec-standards artifacts (built by build-standards)'
    );
    console.log('='.repeat(60));
    console.log(
      '   ✅ Skipped — artifacts already built by yarn build-standards'
    );

    // 2) Compile local contracts (e.g., ECDSA account contract)
    console.log('\n' + '='.repeat(60));
    console.log('📦 Step 2: Compile local contracts');
    console.log('='.repeat(60));

    if (!compileLocalContracts(projectRoot, forceOverwrite)) {
      console.warn('\n⚠️ Some local contracts failed to compile');
    } else {
      console.log('\n✅ All local contracts compiled successfully');
    }

    console.log('\n' + '='.repeat(60));
    console.log('🎉 Build complete!');
    console.log('='.repeat(60) + '\n');
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('\n❌ Build script failed:', errorMessage);
    process.exit(1);
  }
}

main();
