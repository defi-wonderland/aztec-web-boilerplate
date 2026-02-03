/* eslint-disable no-console */
// Run with: tsx scripts/build-contracts.ts [--force]
// This script copies artifacts from @defi-wonderland/aztec-standards and compiles local contracts

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

// Output directory for artifacts (TypeScript wrappers)
const ARTIFACTS_OUTPUT_DIR = 'src/artifacts';
// Output directory for target JSONs (relative to src/, used by wrappers)
const TARGET_OUTPUT_DIR = 'src/target';
// Local contracts directory
const LOCAL_CONTRACTS_DIR = 'contracts';
// NPM package path
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

  console.log(`   📊 Copied ${copiedCount} items, skipped ${skippedCount} existing items`);
  return copiedCount;
}

/**
 * Remove old .ts wrapper files (not .d.ts) to prevent tsx resolution conflicts
 * When we copy .js files from npm, old .ts files can cause issues
 */
function cleanOldTsWrappers(artifactsDir: string, contracts: string[]): void {
  for (const contract of contracts) {
    const tsFile = path.join(artifactsDir, `${contract}.ts`);
    if (fs.existsSync(tsFile)) {
      fs.unlinkSync(tsFile);
      console.log(`   🗑️ Removed old ${contract}.ts (using .js instead)`);
    }
  }
}

/**
 * Copy aztec-standards artifacts from node_modules
 */
function copyAztecStandardsArtifacts(projectRoot: string, forceOverwrite: boolean): void {
  console.log('\n📦 Copying aztec-standards artifacts from node_modules...');

  const npmPackagePath = path.join(projectRoot, NPM_PACKAGE_PATH);

  if (!fs.existsSync(npmPackagePath)) {
    console.error(`❌ Package @defi-wonderland/aztec-standards not found at ${npmPackagePath}`);
    console.error('   Run: yarn add @defi-wonderland/aztec-standards');
    throw new Error('Missing aztec-standards package');
  }

  // Filter for Dripper and Token contracts only
  const contractFilter = (file: string) =>
    (file.includes('Dripper') || file.includes('Token')) && !file.endsWith('.bak');

  // Copy TypeScript wrappers from artifacts/
  const artifactsDir = path.join(projectRoot, ARTIFACTS_OUTPUT_DIR);

  // Remove old .ts files first to avoid tsx resolution conflicts
  cleanOldTsWrappers(artifactsDir, ['Dripper', 'Token']);

  console.log(`\n   📁 Copying TypeScript wrappers to ${ARTIFACTS_OUTPUT_DIR}/`);
  copyFiles(
    path.join(npmPackagePath, 'artifacts'),
    artifactsDir,
    forceOverwrite,
    contractFilter
  );

  // Copy JSON artifacts from target/
  const targetDir = path.join(projectRoot, TARGET_OUTPUT_DIR);
  console.log(`\n   📁 Copying JSON artifacts to ${TARGET_OUTPUT_DIR}/`);
  copyFiles(
    path.join(npmPackagePath, 'target'),
    targetDir,
    forceOverwrite,
    contractFilter
  );

  console.log('\n✅ aztec-standards artifacts copied successfully');
}

/**
 * Compile local contracts using workspace Nargo.toml at root level
 */
function compileLocalContracts(projectRoot: string, forceOverwrite: boolean): boolean {
  const workspaceNargo = path.join(projectRoot, 'Nargo.toml');

  if (!fs.existsSync(workspaceNargo)) {
    console.error(`❌ No workspace Nargo.toml found at ${projectRoot}`);
    return false;
  }

  console.log('\n🔨 Compiling contracts from workspace...');

  // Compile all contracts from workspace root
  if (!tryRun(`cd "${projectRoot}" && aztec compile`)) {
    console.error('   ❌ Failed to compile contracts');
    return false;
  }

  console.log('   ✅ Contracts compiled successfully');


  // TODO: This might not be needed because `yarn codegen` takes care of using a path relative to the target/
  // Copy artifacts from target/ to src/artifacts/
  const targetDir = path.join(projectRoot, 'target');
  const artifactsDir = path.join(projectRoot, ARTIFACTS_OUTPUT_DIR);

  if (fs.existsSync(targetDir)) {
    copyFiles(targetDir, artifactsDir, forceOverwrite, (file) =>
      file.endsWith('.json') && !file.endsWith('.bak')
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
    // 1) Copy aztec-standards artifacts from node_modules
    console.log('='.repeat(60));
    console.log('📦 Step 1: Copy aztec-standards artifacts');
    console.log('='.repeat(60));
    copyAztecStandardsArtifacts(projectRoot, forceOverwrite);

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

