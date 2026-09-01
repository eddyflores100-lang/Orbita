import sharp from "sharp";
import { analyzeWithVision } from "../src/lib/orbita/vision";

async function main() {
  // genera imagen sintética "cocina"
  const svg = `<svg width="800" height="600" xmlns="http://www.w3.org/2000/svg">
    <rect width="800" height="600" fill="#e8e0d0"/>
    <rect y="420" width="800" height="180" fill="#b09a78"/>
    <rect x="60" y="240" width="280" height="180" fill="#7a8a9a"/>
    <rect x="380" y="200" width="360" height="60" fill="#556"/>
    <text x="400" y="90" font-size="48" text-anchor="middle" fill="#333">COCINA TEST</text>
  </svg>`;
  const jpg = await sharp(Buffer.from(svg)).jpeg().toBuffer();
  await sharp(jpg).toFile("/tmp/vision-test.jpg");
  const res = await analyzeWithVision("/tmp/vision-test.jpg");
  console.log("VISION RESULT:", JSON.stringify(res, null, 2));
}
main();
