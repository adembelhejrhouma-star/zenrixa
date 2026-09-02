const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');

const framesDir = 'C:\\zip2\\public';
const frameFiles = [
  'ezgif-frame-003.webp', 'ezgif-frame-015.webp', 'ezgif-frame-021.webp',
  'ezgif-frame-033.webp', 'ezgif-frame-051.webp', 'ezgif-frame-072.webp',
  'ezgif-frame-100.webp', 'ezgif-frame-150.webp', 'ezgif-frame-200.webp', 'ezgif-frame-239.webp'
];

const THRESHOLD = 20; // Minimum pixel value to consider "non-black" (0-255)
const MIN_CONTENT_PIXELS_PER_COLUMN = 3; // Minimum non-black pixels in a column to count as content

async function analyzeFrame(filename) {
  const filepath = path.join(framesDir, filename);
  const img = await loadImage(filepath);
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, img.width, img.height);
  const data = imageData.data;
  const width = img.width;
  const height = img.height;

  let leftmost = width;
  let rightmost = 0;

  for (let x = 0; x < width; x++) {
    let contentPixels = 0;
    for (let y = 0; y < height; y++) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const a = data[idx + 3];
      // Consider pixel "content" if it's not near-black and has alpha
      if (a > 128 && (r > THRESHOLD || g > THRESHOLD || b > THRESHOLD)) {
        contentPixels++;
      }
    }
    if (contentPixels >= MIN_CONTENT_PIXELS_PER_COLUMN) {
      if (x < leftmost) leftmost = x;
      if (x > rightmost) rightmost = x;
    }
  }

  return { filename, leftmost, rightmost, width: rightmost - leftmost };
}

async function main() {
  console.log('Analyzing frames for content bounds...\n');
  const results = [];
  
  for (const file of frameFiles) {
    try {
      const result = await analyzeFrame(file);
      results.push(result);
      console.log(`${file}: leftmost=${result.leftmost}, rightmost=${result.rightmost}, width=${result.width}`);
    } catch (e) {
      console.error(`Error analyzing ${file}:`, e.message);
    }
  }

  // Aggregate across frames
  const allLeft = results.map(r => r.leftmost);
  const allRight = results.map(r => r.rightmost);
  
  const minLeft = Math.min(...allLeft);
  const maxRight = Math.max(...allRight);
  const avgLeft = Math.round(allLeft.reduce((a, b) => a + b, 0) / allLeft.length);
  const avgRight = Math.round(allRight.reduce((a, b) => a + b, 0) / allRight.length);
  
  console.log('\n=== AGGREGATE RESULTS ===');
  console.log(`Min leftmost across frames: ${minLeft}`);
  console.log(`Max rightmost across frames: ${maxRight}`);
  console.log(`Average leftmost: ${avgLeft}`);
  console.log(`Average rightmost: ${avgRight}`);
  console.log(`\nRecommended GLASSES_FIT_BAND:`);
  console.log(`  minX: ${minLeft} (most conservative - covers all frames)`);
  console.log(`  maxX: ${maxRight} (most conservative - covers all frames)`);
  console.log(`  Band width: ${maxRight - minLeft}px`);
  console.log(`\nAlternative (average-based):`);
  console.log(`  minX: ${avgLeft}`);
  console.log(`  maxX: ${avgRight}`);
  console.log(`  Band width: ${avgRight - avgLeft}px`);
  
  // Also test with a slightly lower threshold to catch darker content
  console.log('\n=== Testing with lower threshold (10) ===');
  const THRESHOLD_LOW = 10;
  const resultsLow = [];
  
  for (const file of frameFiles) {
    try {
      const filepath = path.join(framesDir, file);
      const img = await loadImage(filepath);
      const canvas = createCanvas(img.width, img.height);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, img.width, img.height);
      const data = imageData.data;
      const width = img.width;
      const height = img.height;

      let leftmost = width;
      let rightmost = 0;

      for (let x = 0; x < width; x++) {
        let contentPixels = 0;
        for (let y = 0; y < height; y++) {
          const idx = (y * width + x) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          const a = data[idx + 3];
          if (a > 128 && (r > THRESHOLD_LOW || g > THRESHOLD_LOW || b > THRESHOLD_LOW)) {
            contentPixels++;
          }
        }
        if (contentPixels >= MIN_CONTENT_PIXELS_PER_COLUMN) {
          if (x < leftmost) leftmost = x;
          if (x > rightmost) rightmost = x;
        }
      }
      resultsLow.push({ filename: file, leftmost, rightmost });
      console.log(`${file}: leftmost=${leftmost}, rightmost=${rightmost}`);
    } catch (e) {
      console.error(`Error analyzing ${file}:`, e.message);
    }
  }
  
  const minLeftLow = Math.min(...resultsLow.map(r => r.leftmost));
  const maxRightLow = Math.max(...resultsLow.map(r => r.rightmost));
  console.log(`\nLow threshold - Min left: ${minLeftLow}, Max right: ${maxRightLow}, Width: ${maxRightLow - minLeftLow}`);
}

main().catch(console.error);