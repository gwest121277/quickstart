import sharp from "sharp";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const svg = readFileSync(resolve(here, "../icons/icon.svg"));

for (const size of [16, 32, 48, 128]) {
  const out = resolve(here, `../icons/icon-${size}.png`);
  await sharp(svg).resize(size, size).png().toFile(out);
  console.log("wrote", out);
}
