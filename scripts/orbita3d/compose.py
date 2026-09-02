"""ÓRBITA · Composición FFmpeg: clips 3D → crossfades → música → MP4 final.
Uso: python3 compose.py salida.mp4"""
import json
import subprocess
import sys

XFADE = 0.5


def main(out: str) -> None:
    clips = json.load(open("output/clips.json"))
    n = len(clips)
    inputs = []
    for c in clips:
        inputs += ["-i", c["file"]]
    inputs += ["-i", "output/music.wav"]

    filt = []
    prev = "[0:v]"
    off = 0.0
    for i in range(1, n):
        off += clips[i - 1]["duration"] - XFADE
        lab = f"[v{i}]" if i < n - 1 else "[vx]"
        filt.append(f"{prev}[{i}:v]xfade=transition=fade:duration={XFADE}:offset={off:.3f}{lab}")
        prev = lab
    total = sum(c["duration"] for c in clips) - XFADE * (n - 1)
    filt.append(f"[vx]fade=t=in:st=0:d=0.6,fade=t=out:st={total - 0.9:.3f}:d=0.9,"
                f"format=yuv420p[vout]")
    filt.append(f"[{n}:a]atrim=0:{total:.3f},afade=t=in:st=0:d=1.2,"
                f"afade=t=out:st={total - 3.2:.3f}:d=3.2[aout]")

    cmd = (["ffmpeg", "-y", "-loglevel", "error"] + inputs +
           ["-filter_complex", ";".join(filt),
            "-map", "[vout]", "-map", "[aout]",
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "18",
            "-c:a", "aac", "-b:a", "192k",
            "-movflags", "+faststart", out])
    subprocess.run(cmd, check=True)
    print(f"FINAL_OK {out} duracion={total:.1f}s", flush=True)


if __name__ == "__main__":
    main(sys.argv[1])
