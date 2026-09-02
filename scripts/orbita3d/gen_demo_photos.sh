#!/bin/bash
# ÓRBITA — genera 9 fotos demo limpias (sin marcas de agua) para el nuevo seed
set -u
OUT="/home/z/orbita-repo/public/orbita/la-floresta/gen"
mkdir -p "$OUT"

STYLE="professional real estate photography, photorealistic, warm natural daylight, neutral palette with warm wood tones, sharp focus, high quality, no people, no text, no watermark, no logo"

declare -a PROMPTS
PROMPTS[1]="Elegant modern six-story residential building exterior in Quito Ecuador at golden hour, balconies and large glass windows, landscaped entrance garden with native plants, Andes mountains behind, clear sky, $STYLE"
PROMPTS[2]="Bright apartment entrance foyer with light oak wood flooring, white walls, slim modern console table with a plant, open doorway leading to a sunlit living room, $STYLE"
PROMPTS[3]="Spacious modern living room, warm hardwood floors, floor-to-ceiling windows overlooking Quito city skyline and mountains, beige sectional sofa, walnut coffee table, soft afternoon light, $STYLE"
PROMPTS[4]="Modern dining room, solid walnut table set for six, designer pendant lamp above, large window with green garden view, hardwood floors, $STYLE"
PROMPTS[5]="Modern kitchen with light oak cabinetry, white quartz countertops, stainless steel appliances, ceramic backsplash, breakfast bar with two stools, $STYLE"
PROMPTS[6]="Master bedroom with queen bed, warm wood headboard, soft beige linen bedding, large window with Andes mountain view, hardwood floors, morning light, $STYLE"
PROMPTS[7]="Modern bathroom, walk-in glass shower, light wood vanity with white ceramic sink, large round mirror, matte black fixtures, beige stone tiles, $STYLE"
PROMPTS[8]="Apartment terrace with wooden deck, two outdoor lounge chairs, potted plants, frameless glass railing, panoramic view of Quito city and Andes mountains at sunset, $STYLE"
PROMPTS[9]="Cozy home TV room with built-in wooden bookshelf, two comfortable armchairs, warm floor lamp, soft rugs on wood floor, $STYLE"

for i in 1 2 3 4 5 6 7 8 9; do
  n=$(printf "%02d" "$i")
  f="$OUT/photo_$n.png"
  if [ -s "$f" ]; then echo "SKIP photo_$n"; continue; fi
  echo "GEN photo_$n ..."
  z-ai image -p "${PROMPTS[$i]}" -o "$f" -s 1344x768 && echo "OK photo_$n" || echo "FAIL photo_$n"
done
echo "ALL_DONE"
