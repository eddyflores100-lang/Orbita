import { generateMusic } from "/home/z/my-project/src/lib/orbita/music";
import { writeFileSync } from "fs";
const wav = generateMusic({ style: "luxury", bpm: 84, durationSec: 6, seed: 42 });
writeFileSync("/tmp/music.wav", wav);
console.log("WAV bytes:", wav.byteLength);
