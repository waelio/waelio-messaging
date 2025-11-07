#!/usr/bin/env node
/**
 * Icon generation script.
 * Takes an SVG (src/client/favicon.svg) and renders a set of PNG favicons + ICO + Apple touch + manifest icons.
 * Uses @resvg/resvg-js for high-quality SVG rasterization and to-ico for ICO packaging.
 */
import { readFile, writeFile } from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';
import { Resvg } from '@resvg/resvg-js';
import pngToIco from 'png-to-ico';

const projectRoot = path.resolve(process.cwd());
const srcSvg = path.join(projectRoot, 'src', 'client', 'favicon.svg');
const outDir = path.join(projectRoot, 'public');

if (!existsSync(srcSvg)) {
  console.error('[icons] SVG source not found at', srcSvg);
  process.exit(0); // Non-fatal
}
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

const sizes = [16, 32, 48, 64, 180];
async function main() {
  const svgData = await readFile(srcSvg, 'utf8');
  for (const size of sizes) {
    const r = new Resvg(svgData, {
      fitTo: { mode: 'width', value: size },
      background: 'transparent'
    });
    const pngData = r.render();
    const pngBuffer = pngData.asPng();
    const filename = size === 180 ? 'apple-touch-icon.png' : `favicon-${size}x${size}.png`;
    await writeFile(path.join(outDir, filename), pngBuffer);
    console.log('[icons] generated', filename);
  }
  // ICO from 16 & 32
  try {
    const icoSizes = [16, 32];
    const pngBuffers = [];
    for (const size of icoSizes) {
      const r = new Resvg(svgData, { fitTo: { mode: 'width', value: size }, background: 'transparent' });
      pngBuffers.push(r.render().asPng());
    }
    const icoBuffer = await pngToIco(Buffer.from(pngBuffers[0]));
    await writeFile(path.join(outDir, 'favicon.ico'), icoBuffer);
    console.log('[icons] generated favicon.ico');
  } catch (e) {
    console.warn('[icons] ICO generation failed:', e.message);
  }
  // Web manifest
  const manifest = {
    name: 'Messaging Hub',
    short_name: 'Messaging',
    icons: [16,32,48,64,180].map(sz => ({
      src: sz === 180 ? 'apple-touch-icon.png' : `favicon-${sz}x${sz}.png`,
      sizes: `${sz}x${sz}`,
      type: 'image/png'
    })),
    theme_color: '#1976D2',
    background_color: '#FFFFFF',
    display: 'standalone'
  };
  await writeFile(path.join(outDir, 'site.webmanifest'), JSON.stringify(manifest, null, 2));
  console.log('[icons] generated site.webmanifest');
}

main().catch(e => { console.error('[icons] unexpected error', e); process.exit(1); });
