const sharp = require('sharp');
const toIco = require('to-ico');
const fs = require('fs');
const path = require('path');

async function generateFavicon() {
  // Create a simple SVG for a phone icon
  const svg = `
    <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" fill="#007bff" rx="4"/>
      <path d="M8 10 L8 22 L24 22 L24 10 Z" fill="white"/>
      <circle cx="16" cy="12" r="1" fill="#007bff"/>
      <rect x="14" y="14" width="4" height="1" fill="#007bff"/>
      <rect x="14" y="16" width="4" height="1" fill="#007bff"/>
      <rect x="14" y="18" width="4" height="1" fill="#007bff"/>
    </svg>
  `;

  // Generate PNG buffers for different sizes
  const sizes = [16, 32, 48];
  const buffers = await Promise.all(
    sizes.map(size =>
      sharp(Buffer.from(svg))
        .resize(size, size)
        .png()
        .toBuffer()
    )
  );

  // Convert to ICO
  const icoBuffer = await toIco(buffers);

  // Write to public/favicon.ico
  fs.writeFileSync(path.join(__dirname, 'public', 'favicon.ico'), icoBuffer);

  console.log('Favicon generated successfully!');
}

generateFavicon().catch(console.error);