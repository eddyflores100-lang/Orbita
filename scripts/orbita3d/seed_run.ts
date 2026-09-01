// Ejecuta la seed de La Floresta (idempotente): bun scripts/orbita3d/seed_run.ts
import { seedLaFloresta } from "@/lib/orbita/seed";
import { db } from "@/lib/db";

const res = await seedLaFloresta();
console.log("SEED_OK", JSON.stringify(res));
const count = await db.orbitProperty.count();
console.log("PROPERTIES_TOTAL", count);
await db.$disconnect();
