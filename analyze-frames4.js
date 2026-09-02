const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');

const framesDir = 'C:\\zip2\\public';
// Check frames from different parts of the animation
const testFiles = [
  'ezgif-frame-003.webp', 'ezgif-frame-015.webp', 'ezgif-frame-021.webp',
  'ezgif-frame-033.webp', 'ezgif-frame-051.webp', 'ezgif-frame-072.webp',
  'ezgif-frame-100.webp', 'ezgif-frame-150.webp', 'ezgif-frame-200.webp', 'ezgif-frame-239.webp'
];

async function sampleColumns(filename) {
  const filepath = path.join(framesDir, filename);
  const img = await loadImage(filepath);
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, img.width, img.height);
  const data = imageData.data;
  const width = img.width;
  const height = img.height;

  const midY = Math.floor(height / 2);
  // Sample more columns
  const sampleX = [];
  for (let x = 0; x < width; x += 50) sampleX.push(x);
  sampleX.push(width - 1);
  
  // Find peaks and valleys in horizontal profile
  let prevBrightness = -1;
  let peaks = [];
  let valleys = [];
  
  for (const x of sampleX) {
    const idx = (midY * width + x) * 4;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    const brightness = Math.max(r, g, b);
    
    if (prevBrightness !== -1) {
      // Simple peak/valley detection
    }
    prevBrightness = brightness;
  }
  
  // Just output the profile for comparison
  console.log(`\n=== ${filename} ===`);
  for (const x of sampleX) {
    const idx = (midY * width + x) * 4;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    const brightness = Math.max(r, g, b);
    console.log(`x=${x.toString().padStart(4)}: RGB(${r.toString().padStart(3)},${g.toString().padStart(3)},${b.toString().padStart(3)}) max=${brightness.toString().padStart(3)}`);
  }
}

async function main() {
  for (const file of testFiles) {
    await sampleColumns(file);
  }
}

main().catch(console.error);