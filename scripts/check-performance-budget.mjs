import { readFile, stat } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const distDirectory = new URL('../dist/', import.meta.url);
const indexPath = new URL('index.html', distDirectory);
const indexHtml = await readFile(indexPath, 'utf8');
const assetPaths = [
  ...new Set(
    [...indexHtml.matchAll(/(?:src|href)="\/(assets\/[^"]+)"/g)]
      .map(([, assetPath]) => assetPath),
  ),
];

if (assetPaths.length === 0) {
  throw new Error('Üretim giriş belgesinde ölçülecek bir varlık bulunamadı.');
}

const indexTransferBytes = gzipSync(indexHtml).byteLength;
const assets = await Promise.all(assetPaths.map(async (assetPath) => {
  const assetUrl = new URL(assetPath, distDirectory);
  const assetBuffer = await readFile(assetUrl);
  const transferBytes = /\.(?:css|html|js|json|svg)$/i.test(assetPath)
    ? gzipSync(assetBuffer).byteLength
    : (await stat(assetUrl)).size;

  return { assetPath, transferBytes };
}));

const totalTransferBytes = assets.reduce(
  (total, asset) => total + asset.transferBytes,
  indexTransferBytes,
);
const budgetBytes = 150 * 1024;
const formatKiB = bytes => `${(bytes / 1024).toFixed(1)} KiB`;

console.log(`Başlangıç aktarımı: ${formatKiB(totalTransferBytes)} / ${formatKiB(budgetBytes)}`);
for (const asset of assets) {
  console.log(`- ${asset.assetPath}: ${formatKiB(asset.transferBytes)}`);
}

if (totalTransferBytes > budgetBytes) {
  throw new Error(
    `Başlangıç aktarımı performans bütçesini ${formatKiB(totalTransferBytes - budgetBytes)} aştı.`,
  );
}
