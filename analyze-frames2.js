const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');

const framesDir = 'C:\\zip2\\public';
const frameFiles = [
  'ezgif-frame-003.webp', 'ezgif-frame-015.webp', 'ezgif-frame-021.webp',
  'ezgif-frame-033.webp', 'ezgif-frame-051.webp', 'ezgif-frame-072.webp',
  'ezgif-frame-100.webp', 'ezgif-frame-150.webp', 'ezgif-frame-200.webp', 'ezgif-frame-239.webp'
];

async function analyzeFrameDetailed(filename) {
  const filepath = path.join(framesDir, filename);
  const img = await loadImage(filepath);
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, img.width, img.height);
  const data = imageData.data;
  const width = img.width;
  const height = img.height;

  // For each column, calculate the "brightness" (max of RGB) and count of non-dark pixels
  const columnStats = [];
  
  for (let x = 0; x < width; x++) {
    let maxBrightness = 0;
    let brightPixelCount = 0;
    let totalBrightness = 0;
    
    for (let y = 0; y < height; y++) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const brightness = Math.max(r, g, b);
      maxBrightness = Math.max(maxBrightness, brightness);
      totalBrightness += brightness;
      if (brightness > 30) brightPixelCount++;
    }
    
    columnStats.push({
      x,
      maxBrightness,
      avgBrightness: totalBrightness / height,
      brightPixelCount
    });
  }

  // Find contiguous regions of "content" (columns with significant brightness)
  const CONTENT_THRESHOLD = 40; // Minimum avg brightness to consider as content
  const MIN_REGION_WIDTH = 20; // Minimum width of content region
  
  const regions = [];
  let inRegion = false;
  let regionStart = 0;
  
  for (let x = 0; x < width; x++) {
    if (columnStats[x].avgBrightness > CONTENT_THRESHOLD) {
      if (!inRegion) {
        inRegion = true;
        regionStart = x;
      }
    } else {
      if (inRegion) {
        inRegion = false;
        const regionWidth = x - regionStart;
        if (regionWidth >= MIN_REGION_WIDTH) {
          regions.push({ start: regionStart, end: x - 1, width: regionWidth });
        }
      }
    }
  }
  if (inRegion) {
    const regionWidth = width - regionStart;
    if (regionWidth >= MIN_REGION_WIDTH) {
      regions.push({ start: regionStart, end: width - 1, width: regionWidth });
    }
  }

  // Find the largest/widest region (likely the main subject)
  let mainRegion = regions.reduce((max, r) => r.width > max.width ? r : max, { width: 0 });
  
  // Also get overall bounds of all content regions
  const allContentCols = columnStats
    .map((s, i) => ({ x: i, avg: s.avgBrightness }))
    .filter(s => s.avg > CONTENT_THRESHOLD)
    .map(s => s.x);
  
  const overallLeft = allContentCols.length > 0 ? Math.min(...allContentCols) : 0;
  const overallRight = allContentCols.length > 0 ? Math.max(...allContentCols) : width - 1;

  return {
    filename,
    regions,
    mainRegion,
    overallLeft,
    overallRight,
    overallWidth: overallRight - overallLeft,
    columnStats: columnStats.slice(0, 50).map(s => ({ x: s.x, avg: Math.round(s.avgBrightness), max: s.maxBrightness, count: s.brightPixelCount }))
  };
}

async function main() {
  console.log('Detailed frame analysis...\n');
  
  for (const file of frameFiles) {
    try {
      const result = await analyzeFrameDetailed(file);
      console.log(`\n=== ${file} ===`);
      console.log(`Overall content bounds: ${result.overallLeft} - ${result.overallRight} (width: ${result.overallWidth})`);
      console.log(`Main region: ${result.mainRegion.start} - ${result.mainRegion.end} (width: ${result.mainRegion.width})`);
      console.log(`All regions:`, result.regions.map(r => `${r.start}-${r.end} (${r.width})`).join(', '));
      // Show first 50 columns brightness
      // console.log('First 50 cols:', result.columnStats);
    } catch (e) {
      console.error(`Error analyzing ${file}:`, e.message);
    }
  }
}

main().catch(console.error);