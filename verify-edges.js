const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');

const framesDir = 'C:\\zip2\\public';
const testFiles = ['ezgif-frame-003.jpg', 'ezgif-frame-150.jpg', 'ezgif-frame-239.jpg'];

async function findContentEdges(filename) {
  const filepath = path.join(framesDir, filename);
  const img = await loadImage(filepath);
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, img.width, img.height);
  const data = imageData.data;
  const width = img.width;
  const height = img.height;

  // Scan from left: find first column with significant content
  let leftEdge = 0;
  for (let x = 0; x < width; x++) {
    let brightCount = 0;
    for (let y = 0; y < height; y++) {
      const idx = (y * width + x) * 4;
      const r = data[idx], g = data[idx+1], b = data[idx+2];
      const brightness = Math.max(r, g, b);
      if (brightness > 50) brightCount++;
    }
    if (brightCount > height * 0.05) { // 5% of rows have brightness > 50
      leftEdge = x;
      break;
    }
  }

  // Scan from right: find last column with significant content
  let rightEdge = width - 1;
  for (let x = width - 1; x >= 0; x--) {
    let brightCount = 0;
    for (let y = 0; y < height; y++) {
      const idx = (y * width + x) * 4;
      const r = data[idx], g = data[idx+1], b = data[idx+2];
      const brightness = Math.max(r, g, b);
      if (brightness > 50) brightCount++;
    }
    if (brightCount > height * 0.05) {
      rightEdge = x;
      break;
    }
  }

  // Also find the "main content regions" - contiguous bright areas
  const midY = Math.floor(height / 2);
  const profile = [];
  for (let x = 0; x < width; x++) {
    const idx = (midY * width + x) * 4;
    const r = data[idx], g = data[idx+1], b = data[idx+2];
    profile.push(Math.max(r, g, b));
  }

  // Find regions above threshold
  const THRESHOLD = 80;
  const regions = [];
  let inRegion = false, regionStart = 0;
  for (let x = 0; x < width; x++) {
    if (profile[x] > THRESHOLD) {
      if (!inRegion) { inRegion = true; regionStart = x; }
    } else {
      if (inRegion) { inRegion = false; regions.push({ start: regionStart, end: x-1, width: x-regionStart }); }
    }
  }
  if (inRegion) regions.push({ start: regionStart, end: width-1, width: width-regionStart });

  return { filename, leftEdge, rightEdge, regions, fullWidth: rightEdge - leftEdge };
}

async function main() {
  console.log('=== CONTENT EDGE ANALYSIS ===\n');
  for (const file of testFiles) {
    const result = await findContentEdges(file);
    console.log(`${file}:`);
    console.log(`  First content column (brightness>50, 5% rows): x=${result.leftEdge}`);
    console.log(`  Last content column:  x=${result.rightEdge}`);
    console.log(`  Content span: ${result.fullWidth}px (${result.leftEdge}-${result.rightEdge})`);
    console.log(`  Bright regions (mid-row, >80):`, result.regions.map(r => `${r.start}-${r.end} (${r.width}px)`).join(', '));
    console.log('');
  }

  // Calculate scales for different band widths at 375px
  console.log('=== SCALE CALCULATIONS @ 375px ===');
  const bands = [
    { name: 'Full frame (0-1279)', width: 1279 },
    { name: 'Content span (measured)', width: null }, // will fill from data
    { name: 'Left region only (0-350)', width: 350 },
    { name: 'Right region only (950-1279)', width: 329 },
    { name: 'Both regions + gap (0-1279)', width: 1279 },
  ];
  
  // We'll compute from actual measurements
}

main().catch(console.error);