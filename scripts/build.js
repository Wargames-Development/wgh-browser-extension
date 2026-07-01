import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const requestedTarget = process.argv[2] || 'all';
const targets = requestedTarget === 'all' ? ['chromium', 'firefox'] : [requestedTarget];

const ignoredBuildEntries = new Set([
  '.DS_Store',
  '.AppleDouble',
  '.LSOverride',
  '__MACOSX'
]);

const shouldSkipBuildEntry = (entry) => entry.startsWith('._') || ignoredBuildEntries.has(entry);

const copyRecursive = (src, dest) => {
  const entry = path.basename(src);
  if (shouldSkipBuildEntry(entry)) {
    return;
  }

  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const childEntry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, childEntry), path.join(dest, childEntry));
    }
    return;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
};

for (const target of targets) {
  if (!['chromium', 'firefox'].includes(target)) {
    throw new Error(`Unknown build target: ${target}`);
  }

  const outDir = path.join(root, 'dist', target);
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  copyRecursive(path.join(root, 'src'), path.join(outDir, 'src'));
  copyRecursive(path.join(root, 'icons'), path.join(outDir, 'icons'));
  fs.copyFileSync(
    path.join(root, 'manifests', `manifest.${target}.json`),
    path.join(outDir, 'manifest.json')
  );

  for (const file of ['README.md', 'PRIVACY.md', 'SECURITY.md']) {
    fs.copyFileSync(path.join(root, file), path.join(outDir, file));
  }

  console.log(`Built ${target} extension at ${path.relative(root, outDir)}`);
}
