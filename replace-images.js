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

// For each file, we need to know the base directory to check for .webp existence
const fileBaseDirs = {
  'analyze-frames.js': 'public',
  'analyze-frames2.js': 'public',
  'analyze-frames3.js': 'public',
  'analyze-frames4.js': 'public',
  'glasses.html': '.',  // root
  'index.html': '.',  // root
  'public/index.html': 'public',
  'public/zip/index.html': 'public/zip'
};

function checkWebpExists(baseDir, imgPath) {
  // Remove leading path prefixes like "public/", "zip/", "assets/images/"
  let cleanPath = imgPath;
  if (cleanPath.startsWith('public/')) cleanPath = cleanPath.slice(7);
  if (cleanPath.startsWith('zip/')) cleanPath = cleanPath.slice(4);
  if (cleanPath.startsWith('assets/images/')) cleanPath = cleanPath.slice(14);
  
  const webpPath = path.join(ROOT, baseDir, cleanPath.replace(/\.(jpg|jpeg|png)$/i, '.webp'));
  return fs.existsSync(webpPath);
}

function replaceInFile(filePath, baseDir) {
  const content = fs.readFileSync(filePath, 'utf8');
  let newContent = content;
  let replacements = [];

  // Pattern to match image references: .jpg, .jpeg, .png in various contexts
  // We need to be careful to only replace when .webp exists
  
  // Regex to find image file references
  const imgRegex = /(["'`])([^"'`\s]+\.(?:jpg|jpeg|png))\1/g;
  
  let match;
  while ((match = imgRegex.exec(content)) !== null) {
    const quote = match[1];
    const imgPath = match[2];
    const fullMatch = match[0];
    
    if (checkWebpExists(baseDir, imgPath)) {
      const webpPath = imgPath.replace(/\.(jpg|jpeg|png)$/i, '.webp');
      const newMatch = quote + webpPath + quote;
      newContent = newContent.replace(fullMatch, newMatch);
      replacements.push({ from: imgPath, to: webpPath });
    }
  }

  // Also handle <img src="..."> attributes without quotes in regex above
  // The regex above should catch quoted strings. Let's also check for unquoted (rare)
  
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
  
  const baseDir = fileBaseDirs[file] || '.';
  const replacements = replaceInFile(fullPath, baseDir);
  
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
console.log(`Files modified: ${filesToProcess.filter(f => {
  const fullPath = path.join(ROOT, f);
  return fs.existsSync(fullPath);
}).length}`);