// Copia os SVGs do Twemoji para public/twemoji/svg para que sejam servidos
// localmente (sem depender de CDN em runtime). Roda automaticamente antes de
// `dev` e `build` (ver package.json). Idempotente.
import { cp, mkdir, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'node_modules', '@twemoji', 'svg');
const dest = path.join(root, 'public', 'twemoji', 'svg');

if (!existsSync(src)) {
  console.warn('[sync-twemoji] @twemoji/svg não encontrado — pulei a cópia.');
  process.exit(0);
}

const srcCount = (await readdir(src)).filter((f) => f.endsWith('.svg')).length;
let destCount = 0;
if (existsSync(dest)) {
  destCount = (await readdir(dest)).filter((f) => f.endsWith('.svg')).length;
}

if (destCount === srcCount && srcCount > 0) {
  console.log(`[sync-twemoji] ${destCount} ícones já sincronizados.`);
  process.exit(0);
}

await mkdir(dest, { recursive: true });
await cp(src, dest, { recursive: true });
console.log(`[sync-twemoji] ${srcCount} ícones copiados para public/twemoji/svg.`);
