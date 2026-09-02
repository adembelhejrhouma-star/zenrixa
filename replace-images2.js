const fs = require('fs');
const path = require('path');

const ROOT = 'C:\\zip2';

// Files to process
const filesToProcess = [
  'analyze-frames.js',
  'analyze-frames2.js',
  'analyze-frames3.js',
  'analyze-frames4.js',
  'glasses.html',
  'index.html',
  'public/index.html',
  'public/zip/index.html'
];

function checkWebpExists(fullImgPath) {
  // fullImgPath is the path as written in the source file
  // We need to resolve it relative to the project root
  
  let checkPath = fullImgPath;
  
  // Handle different path prefixes
  if (checkPath.startsWith('public/')) {
    checkPath = checkPath.slice(7); // remove 'public/'
    const webpPath = path.join(ROOT, 'public', checkPath.replace(/\.(jpg|jpeg|png)$/i, '.webp'));
    return fs.existsSync(webpPath);
  }
  if (checkPath.startsWith('zip/')) {
    checkPath = checkPath.slice(4); // remove 'zip/'
    const webpPath = path.join(ROOT, 'public', 'zip', checkPath.replace(/\.(jpg|jpeg|png)$/i, '.webp'));
    return fs.existsSync(webpPath);
  }
  if (checkPath.startsWith('assets/images/')) {
    checkPath = checkPath.slice(14); // remove 'assets/images/'
    // Check both root/assets and public/assets
    const webpPath1 = path.join(ROOT, 'assets', 'images', checkPath.replace(/\.(jpg|jpeg|png)$/i, '.webp'));
    const webpPath2 = path.join(ROOT, 'public', 'assets', 'images', checkPath.replace(/\.(jpg|jpeg|png)$/i, '.webp'));
    return fs.existsSync(webpPath1) || fs.existsSync(webpPath2);
  }
  // Relative to root
  const webpPath = path.join(ROOT, checkPath.replace(/\.(jpg|jpeg|png)$/i, '.webp'));
  return fs.existsSync(webpPath);
}

function getWebpPath(fullImgPath) {
  // Returns the .webp path with the same prefix structure
  return fullImgPath.replace(/\.(jpg|jpeg|png)$/i, '.webp');
}

function replaceInFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  let newContent = content;
  let replacements = [];

  // Pattern to match image references in quoted strings
  const imgRegex = /(["'`])([^"'`\s]+\.(?:jpg|jpeg|png))\1/g;
  
  let match;
  while ((match = imgRegex.exec(content)) !== null) {
    const quote = match[1];
    const imgPath = match[2];
    const fullMatch = match[0];
    
    if (checkWebpExists(imgPath)) {
      const webpPath = getWebpPath(imgPath);
      const newMatch = quote + webpPath + quote;
      newContent = newContent.replace(fullMatch, newMatch);
      replacements.push({ from: imgPath, to: webpPath });
    }
  }

  // Also handle HTML img src attributes (already covered by above regex)
  // And CSS url() references
  const cssUrlRegex = /url\((["']?)([^"')]+\.(?:jpg|jpeg|png))\1\)/gi;
  while ((match = cssUrlRegex.exec(content)) !== null) {
    const quote = match[1];
    const imgPath = match[2];
    const fullMatch = match[0];
    
    if (checkWebpExists(imgPath)) {
      const webpPath = getWebpPath(imgPath);
      const newMatch = `url(${quote}${webpPath}${quote})`;
      newContent = newContent.replace(fullMatch, newMatch);
      replacements.push({ from: `url(${imgPath})`, to: `url(${webpPath})` });
    }
  }

  if (replacements.length > 0) {
    fs.writeFileSync(filePath, newContent, 'utf8');
  }
  
  return replacements;
}

console.log('Starting image reference replacement...\n');

let totalReplacements = 0;

for (const file of filesToProcess) {
  const fullPath = path.join(ROOT, file);
  if (!fs.existsSync(fullPath)) {
    console.log(`SKIP: ${file} (not found)`);
    continue;
  }
  
  const replacements = replaceInFile(fullPath);
  
  if (replacements.length > 0) {
    console.log(`\n${file}:`);
    for (const r of replacements) {
      console.log(`  ${r.from} -> ${r.to}`);
    }
    totalReplacements += replacements.length;
  } else {
    console.log(`${file}: No replacements needed`);
  }
}

console.log(`\n=== SUMMARY ===`);
console.log(`Total replacements: ${totalReplacements}`);