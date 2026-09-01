"""ÓRBITA · Unión secuencial por pares con xfade (resumible, CPU limitada).
Cada corrida añade un clip al acumulador; salta pares ya hechos.
Uso: python3 xfade_seq.py [salida_final]"""
import json
import os
import subprocess
import sys

XFADE = 0.5
V = ["-c:v", "libx264", "-preset", "veryfast", "-crf", "17",
     "-pix_fmt", "yuv420p"]


def probe_dur(path):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries",
                        "format=duration", "-of", "csv=p=0", path],
                       capture_output=True, text=True)
    return float(r.stdout.strip())


def main() -> None:
    clips = json.load(open("output/clips.json"))
    acc = clips[0]["file"]
    acc_dur = probe_dur(acc)
    for i, c in enumerate(clips[1:], start=2):
        out = f"output/_acc_{i:02d}.mp4"
        if os.path.exists(out):
            acc, acc_dur = out, probe_dur(out)
            print(f"par {i} ya listo (skip) acc={acc_dur:.2f}s", flush=True)
            continue
        off = acc_dur - XFADE
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error",
                        "-i", acc, "-i", c["file"],
                        "-filter_complex",
                        f"[0:v][1:v]xfade=transition=fade:duration={XFADE}:offset={off:.3f}[v]",
                        "-map", "[v]"] + V + [out + ".tmp.mp4"], check=True)
        os.replace(out + ".tmp.mp4", out)
        acc, acc_dur = out, probe_dur(out)
        print(f"par {i} OK acc={acc_dur:.2f}s", flush=True)

    # final: acumulador + música + fades
    final = sys.argv[1] if len(sys.argv) > 1 else "ORBITA_3D_LaFloresta.mp4"
    total = acc_dur
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error",
                    "-i", acc, "-i", "output/music.wav", "-filter_complex",
                    f"[0:v]fade=t=in:st=0:d=0.6,fade=t=out:st={total-0.9:.3f}:d=0.9,"
                    f"format=yuv420p[v];"
                    f"[1:a]atrim=0:{total:.3f},afade=t=in:st=0:d=1.2,"
                    f"afade=t=out:st={total-3.2:.3f}:d=3.2[a]",
                    "-map", "[v]", "-map", "[a]",
                    "-c:v", "libx264", "-preset", "medium", "-crf", "18",
                    "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart",
                    final + ".tmp.mp4"], check=True)
    os.replace(final + ".tmp.mp4", final)
    print(f"FINAL_OK {final} {total:.2f}s", flush=True)


if __name__ == "__main__":
    main()
