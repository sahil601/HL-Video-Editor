const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const pngToIco = require('png-to-ico').default || require('png-to-ico');

const sourceJpg = 'C:/Users/sahil/.gemini/antigravity-ide/brain/ffbbcf6d-8d73-46f4-9e45-212000034cbd/hl_app_icon_1792346446961.jpg';
const buildDir = path.join(__dirname, '../build');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;

if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir, { recursive: true });
}

console.log('Source image exists:', fs.existsSync(sourceJpg));
console.log('Using ffmpeg at:', ffmpegPath);

const sizes = [256, 128, 64, 48, 32, 16];
const generatedPngs = [];

// 1. Generate master 512x512 PNG
const masterPng = path.join(buildDir, 'icon.png');
execFileSync(ffmpegPath, ['-y', '-i', sourceJpg, '-vf', 'scale=512:512', masterPng]);
console.log('Generated master icon:', masterPng, 'size:', fs.statSync(masterPng).size);

// 2. Generate each standard icon size for .ico
for (const size of sizes) {
  const pngPath = path.join(buildDir, `icon_${size}.png`);
  execFileSync(ffmpegPath, ['-y', '-i', sourceJpg, '-vf', `scale=${size}:${size}`, pngPath]);
  generatedPngs.push(pngPath);
}

// 3. Assemble multi-resolution icon.ico
pngToIco(generatedPngs)
  .then((buf) => {
    const icoPath = path.join(buildDir, 'icon.ico');
    fs.writeFileSync(icoPath, buf);
    console.log('Successfully created multi-resolution ICO at:', icoPath, 'size:', buf.length, 'bytes');

    // Also copy to public/ directory for browser/favicon usage
    const publicDir = path.join(__dirname, '../public');
    if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
    fs.copyFileSync(icoPath, path.join(publicDir, 'favicon.ico'));
    fs.copyFileSync(masterPng, path.join(publicDir, 'icon.png'));

    // Clean up temporary size PNGs, keeping master icon.png and icon.ico
    for (const p of generatedPngs) {
      try { fs.unlinkSync(p); } catch (e) {}
    }
    console.log('Icon generation completed successfully!');
  })
  .catch((err) => {
    console.error('Failed to create ICO:', err);
    process.exit(1);
  });
