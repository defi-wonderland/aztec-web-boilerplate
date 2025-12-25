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
 * Compile local contracts (e.g., ECDSA account contract)
 */
function compileLocalContracts(projectRoot: string, forceOverwrite: boolean): boolean {
  const contractsDir = path.join(projectRoot, LOCAL_CONTRACTS_DIR);

  if (!fs.existsSync(contractsDir)) {
    console.log(`⚠️ No local contracts directory found at ${contractsDir}`);
    return true;
  }

  // Find all contract directories (those with Nargo.toml)
  const contractDirs = fs.readdirSync(contractsDir).filter((dir) => {
    const nargoPath = path.join(contractsDir, dir, 'Nargo.toml');
    return fs.existsSync(nargoPath);
  });

  if (contractDirs.length === 0) {
    console.log('📭 No local contracts found to compile');
    return true;
  }

  console.log(`\n🔨 Processing ${contractDirs.length} local contract(s)...`);
  let allSuccess = true;

  for (const contractDir of contractDirs) {
    const contractPath = path.join(contractsDir, contractDir);
    const targetDir = path.join(contractPath, 'target');
    const artifactsDir = path.join(projectRoot, ARTIFACTS_OUTPUT_DIR);

    console.log(`\n   📦 Processing ${contractDir}...`);

    // Check if we already have compiled artifacts
    const hasExistingArtifacts = fs.existsSync(targetDir) &&
      fs.readdirSync(targetDir).some((f) => f.endsWith('.json') && !f.endsWith('.bak'));

    // Try to compile (using nargo or aztec-nargo)
    let compiled = false;
    
    // Try nargo first (standard Noir compiler)
    if (tryRun(`cd "${contractPath}" && nargo compile 2>/dev/null`)) {
      console.log(`   ✅ ${contractDir} compiled with nargo`);
      compiled = true;
    }
    // Try aztec-nargo if available
    else if (tryRun(`cd "${contractPath}" && aztec-nargo compile 2>/dev/null`)) {
      console.log(`   ✅ ${contractDir} compiled with aztec-nargo`);
      compiled = true;
    }
    // Try aztec compile as fallback
    else if (tryRun(`cd "${contractPath}" && aztec compile . 2>/dev/null`)) {
      console.log(`   ✅ ${contractDir} compiled with aztec compile`);
      compiled = true;
    }

    if (!compiled) {
      if (hasExistingArtifacts) {
        console.log(`   ⚠️ Compilation failed, but using existing artifacts`);
      } else {
        console.warn(`   ❌ Failed to compile ${contractDir} (no existing artifacts)`);
        allSuccess = false;
        continue;
      }
    }

    // Copy artifacts to src/artifacts
    if (fs.existsSync(targetDir)) {
      copyFiles(targetDir, artifactsDir, forceOverwrite, (file) =>
        file.endsWith('.json') && !file.endsWith('.bak')
      );
    }
  }

  return allSuccess;
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

