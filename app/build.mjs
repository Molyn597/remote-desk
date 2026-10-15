import { cp, mkdir } from 'node:fs/promises';
import { build } from 'esbuild';

const common = { bundle: true, sourcemap: true, logLevel: 'info' };

await mkdir('dist', { recursive: true });
await Promise.all([
  build({
    ...common,
    entryPoints: ['src/main/main.ts'],
    outfile: 'dist/main.js',
    platform: 'node',
    format: 'cjs',
    external: ['electron', '@jitsi/robotjs', 'electron-updater'],
  }),
  build({
    ...common,
    entryPoints: ['src/preload/preload.ts'],
    outfile: 'dist/preload.js',
    platform: 'node',
    format: 'cjs',
    external: ['electron'],
  }),
  build({
    ...common,
    entryPoints: ['src/renderer/renderer.ts', 'src/renderer/session.ts'],
    outdir: 'dist',
    platform: 'browser',
    format: 'esm',
  }),
  ...['index.html', 'styles.css', 'session.html', 'session.css'].map((file) =>
    cp(`src/renderer/${file}`, `dist/${file}`),
  ),
  cp('../CHANGELOG.md', 'dist/CHANGELOG.md'),
  cp('build/icon.png', 'dist/icon.png'),
]);
