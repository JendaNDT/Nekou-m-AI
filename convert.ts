import sharp from 'sharp';
import fs from 'fs';

async function convert() {
  const svgBuffer = fs.readFileSync('./public/icon-512.svg');
  
  await sharp(svgBuffer)
    .resize(192, 192)
    .png()
    .toFile('./public/icon-192.png');
    
  await sharp(svgBuffer)
    .resize(512, 512)
    .png()
    .toFile('./public/icon-512.png');
    
  console.log('Conversion successful!');
}

convert().catch(console.error);
