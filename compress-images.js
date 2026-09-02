const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const EXCLUDE_DIRS = ['node_modules', '.next', '.git', 'testsprite_tests'];
const IMAGE_EXTS = ['.jpg', '.jpeg', '.png'];

let totalOriginalSize = 0;
let totalCompressedSize = 0;
let fileCount = 0;

function shouldExclude(dir) {
  return EXCLUDE_DIRS.some(excluded => dir.includes(excluded));
}

async function walkDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const promises = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (!shouldExclude(fullPath)) {
        promises.push(walkDir(fullPath));
      }
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (IMAGE_EXTS.includes(ext)) {
        promises.push(processImage(fullPath));
      }
    }
  }

  await Promise.all(promises);
}

async function processImage(filePath) {
  try {
    const originalStat = fs.statSync(filePath);
    const originalSize = originalStat.size;

    const webpPath = filePath.replace(/\.(jpg|jpeg|png)$/i, '.webp');

    await sharp(filePath)
      .webp({ quality: 78 })
      .toFile(webpPath);

    const compressedStat = fs.statSync(webpPath);
    const compressedSize = compressedStat.size;

    const savings = originalSize - compressedSize;
    const savingsPercent = ((savings / originalSize) * 100).toFixed(1);

    totalOriginalSize += originalSize;
    totalCompressedSize += compressedSize;
    fileCount++;

    console.log(`${filePath}`);
    console.log(`  Original: ${formatBytes(originalSize)} | WebP: ${formatBytes(compressedSize)} | Saved: ${formatBytes(savings)} (${savingsPercent}%)`);
    console.log('');
  } catch (err) {
    console.error(`Error processing ${filePath}:`, err.message);
  }
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

async function main() {
  console.log('Starting image compression...\n');
  const projectRoot = __dirname;

  await walkDir(projectRoot);

  console.log('================== SUMMARY ==================');
  console.log(`Files processed: ${fileCount}`);
  console.log(`Total original size: ${formatBytes(totalOriginalSize)}`);
  console.log(`Total compressed size: ${formatBytes(totalCompressedSize)}`);
  console.log(`Total saved: ${formatBytes(totalOriginalSize - totalCompressedSize)} (${((totalOriginalSize - totalCompressedSize) / totalOriginalSize * 100).toFixed(1)}%)`);
}

main().catch(console.error);