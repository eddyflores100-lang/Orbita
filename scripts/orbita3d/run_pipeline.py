"""ÓRBITA · Pipeline completo: fotos reales → 3D real (LDI) → MP4 final.
Ejecuta: profundidad → clips 3D (5 movimientos de cámara) → música → video."""
import glob
import json
import os
import subprocess
import sys

from choreo import CYCLE, DUR

XFADE = 0.5


def sh(cmd):
    print("+", " ".join(cmd), flush=True)
    subprocess.run(cmd, check=True)


def main() -> None:
    photos = sorted(p for p in glob.glob("input/photo_*")
                    if not p.endswith((".npy", ".png")))
    assert photos, "no hay fotos en input/"
    os.makedirs("output", exist_ok=True)

    if any(not os.path.exists(f"depth/{os.path.splitext(os.path.basename(p))[0]}.npy")
           for p in photos):
        sh([sys.executable, "depth_anything.py"])
    else:
        print("profundidad ya calculada (skip)", flush=True)

    clips = []
    for i, p in enumerate(photos):
        move = CYCLE[i % len(CYCLE)]
        stem = os.path.splitext(os.path.basename(p))[0]
        out = f"output/clip_{i + 1:02d}_{stem}.mp4"
        if os.path.exists(out):
            print(f"clip existente (skip): {out}", flush=True)
        else:
            sh([sys.executable, "render_worker.py", p, move, out])
        clips.append({"file": out, "duration": DUR[move], "move": move, "photo": p})
    json.dump(clips, open("output/clips.json", "w"), indent=2)

    total = sum(c["duration"] for c in clips) - XFADE * (len(clips) - 1)
    sh([sys.executable, "music_gen.py", "cinematic", f"{total:.2f}", "output/music.wav"])

    final = sys.argv[1] if len(sys.argv) > 1 else "output/ORBITA_video_3d.mp4"
    sh([sys.executable, "compose.py", final])
    print("PIPELINE_OK", final, flush=True)


if __name__ == "__main__":
    main()
