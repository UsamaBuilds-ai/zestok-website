// jimp is published as ESM; use dynamic import for compatibility
async function importJimp() {
  const mod = await import('jimp');
  return mod.Jimp || mod.default || mod;
}
async function importPngToIco() {
  const mod = await import('png-to-ico');
  return mod.default || mod;
}
const path = require('path');
const fs = require('fs');

async function makeIco() {
  const projectRoot = path.join(__dirname, '..');
  const srcIcon = path.join(projectRoot, 'Icons', 'ico.ico');
  const outIcon = path.join(projectRoot, 'Icons', 'app.ico');

  if (!fs.existsSync(srcIcon)) {
    console.error('Source icon not found:', srcIcon);
    process.exit(1);
  }

  const sizes = [256, 128, 64, 48, 32, 16];
  const images = [];

  const Jimp = await importJimp();
  // ICO cannot be decoded by Jimp directly. Use icojs to extract PNG frame.
  const icojs = await import('icojs');
  const icoBuffer = fs.readFileSync(srcIcon);
  const frames = await icojs.decodeIco(icoBuffer);

  if (!frames || frames.length === 0) {
    throw new Error('No frames extracted from ICO');
  }

  // Use extracted PNG frames directly (they usually include multiple sizes)
  for (const f of frames) {
    const buf = Buffer.from(f.buffer || f.data || f);
    // only PNG-like buffers
    if (buf && buf.length > 0) images.push(buf);
  }

  // fall back: if no frames were PNG, abort
  if (images.length === 0) throw new Error('No PNG frames found in ICO');

  const pngToIcoFn = await importPngToIco();
  const outIcoBuffer = await pngToIcoFn(images);
  fs.writeFileSync(outIcon, outIcoBuffer);
  console.log('Generated', outIcon);
}

makeIco().catch((err) => {
  console.error(err);
  process.exit(1);
});
