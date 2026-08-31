const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');

const framesDir = 'C:\\zip2\\public';
const testFiles = ['ezgif-frame-003.jpg', 'ezgif-frame-015.jpg', 'ezgif-frame-021.jpg'];

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

  // Sample specific columns across the width
  const sampleX = [0, 100, 200, 300, 400, 451, 500, 550, 600, 640, 680, 713, 720, 750, 800, 850, 900, 976, 1000, 1100, 1200, 1279];
  
  console.log(`\n=== ${filename} ===`);
  console.log('x\tavgBright\tmaxBright\tbrightCount(>30)\tbrightCount(>50)\tbrightCount(>80)');
  
  for (const x of sampleX) {
    let totalBrightness = 0;
    let maxBrightness = 0;
    let count30 = 0, count50 = 0, count80 = 0;
    
    for (let y = 0; y < height; y++) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const brightness = Math.max(r, g, b);
      maxBrightness = Math.max(maxBrightness, brightness);
      totalBrightness += brightness;
      if (brightness > 30) count30++;
      if (brightness > 50) count50++;
      if (brightness > 80) count80++;
    }
    
    const avgBrightness = totalBrightness / height;
    console.log(`${x}\t${avgBrightness.toFixed(1)}\t\t${maxBrightness}\t\t${count30}\t\t\t${count50}\t\t\t${count80}`);
  }
  
  // Also check horizontal profile at middle row (y = 360)
  const midY = Math.floor(height / 2);
  console.log(`\nHorizontal profile at y=${midY}:`);
  for (const x of sampleX) {
    const idx = (midY * width + x) * 4;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    const brightness = Math.max(r, g, b);
    console.log(`x=${x}: RGB(${r},${g},${b}) max=${brightness}`);
  }
}

async function main() {
  for (const file of testFiles) {
    await sampleColumns(file);
  }
}

main().catch(console.error);