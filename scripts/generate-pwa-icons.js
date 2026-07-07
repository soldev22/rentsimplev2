const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const iconsDir = path.join(__dirname, '../public/icons');

// Ensure icons directory exists
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Define brand colors
const PRIMARY_COLOR = '#003366'; // Dark blue
const ACCENT_COLOR = '#ffffff'; // White
const BG_COLOR = '#f0f4f8'; // Light background

/**
 * Create a base SVG icon with text
 */
function createIconSvg(size, text = 'RS', isMaskable = false) {
  const padding = isMaskable ? size * 0.1 : 0;
  const innerSize = size - padding * 2;
  const fontSize = Math.round(size * 0.5);
  
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    ${isMaskable ? '' : `<rect width="${size}" height="${size}" fill="${BG_COLOR}"/>`}
    <rect x="${padding}" y="${padding}" width="${innerSize}" height="${innerSize}" rx="${innerSize * 0.15}" fill="${PRIMARY_COLOR}"/>
    <text x="${size/2}" y="${size/2 + fontSize/3}" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="bold" fill="${ACCENT_COLOR}" text-anchor="middle" dominant-baseline="middle">${text}</text>
  </svg>`;
}

/**
 * Create a screenshot placeholder
 */
function createScreenshotSvg(width, height) {
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${width}" height="${height}" fill="${BG_COLOR}"/>
    <rect x="0" y="0" width="${width}" height="80" fill="${PRIMARY_COLOR}"/>
    <text x="${width/2}" y="50" font-family="Arial, sans-serif" font-size="48" font-weight="bold" fill="${ACCENT_COLOR}" text-anchor="middle">RentSimple</text>
    <rect x="20" y="120" width="${width - 40}" height="100" rx="8" fill="${PRIMARY_COLOR}" opacity="0.1"/>
    <rect x="20" y="240" width="${width - 40}" height="100" rx="8" fill="${PRIMARY_COLOR}" opacity="0.1"/>
  </svg>`;
}

/**
 * Create a shortcut icon with specific label
 */
function createShortcutSvg(size, label, icon) {
  const iconMap = {
    'dashboard': '📊',
    'properties': '🏠',
    'maintenance': '🔧'
  };
  
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${size}" height="${size}" fill="${BG_COLOR}"/>
    <circle cx="${size/2}" cy="${size/2}" r="${size * 0.35}" fill="${PRIMARY_COLOR}"/>
    <text x="${size/2}" y="${size/2 + size*0.12}" font-family="Arial, sans-serif" font-size="${Math.round(size*0.4)}" text-anchor="middle" dominant-baseline="middle">${iconMap[icon] || '📱'}</text>
  </svg>`;
}

async function generateIcon(svgString, outputPath, width, height) {
  try {
    await sharp(Buffer.from(svgString))
      .png()
      .toFile(outputPath);
    console.log(`✓ Generated: ${path.basename(outputPath)}`);
  } catch (error) {
    console.error(`✗ Failed to generate ${path.basename(outputPath)}:`, error.message);
  }
}

async function generateAllIcons() {
  console.log('🎨 Generating PWA icons...\n');

  try {
    // Regular icons
    await generateIcon(
      createIconSvg(192, 'RS'),
      path.join(iconsDir, 'icon-192.png'),
      192,
      192
    );

    await generateIcon(
      createIconSvg(512, 'RS'),
      path.join(iconsDir, 'icon-512.png'),
      512,
      512
    );

    // Maskable icons (for adaptive PWA icons)
    await generateIcon(
      createIconSvg(192, 'RS', true),
      path.join(iconsDir, 'icon-192-maskable.png'),
      192,
      192
    );

    await generateIcon(
      createIconSvg(512, 'RS', true),
      path.join(iconsDir, 'icon-512-maskable.png'),
      512,
      512
    );

    // Apple touch icon (180x180)
    await generateIcon(
      createIconSvg(180, 'RS'),
      path.join(iconsDir, 'apple-touch-icon.png'),
      180,
      180
    );

    // Shortcut icons
    await generateIcon(
      createShortcutSvg(192, 'Dashboard', 'dashboard'),
      path.join(iconsDir, 'shortcut-dashboard-192.png'),
      192,
      192
    );

    await generateIcon(
      createShortcutSvg(192, 'Properties', 'properties'),
      path.join(iconsDir, 'shortcut-properties-192.png'),
      192,
      192
    );

    await generateIcon(
      createShortcutSvg(192, 'Maintenance', 'maintenance'),
      path.join(iconsDir, 'shortcut-maintenance-192.png'),
      192,
      192
    );

    // Screenshots
    await generateIcon(
      createScreenshotSvg(540, 720),
      path.join(iconsDir, 'screenshot-narrow.png'),
      540,
      720
    );

    await generateIcon(
      createScreenshotSvg(1280, 720),
      path.join(iconsDir, 'screenshot-wide.png'),
      1280,
      720
    );

    console.log('\n✅ All PWA icons generated successfully!');
  } catch (error) {
    console.error('\n❌ Error generating icons:', error);
    process.exit(1);
  }
}

generateAllIcons();
