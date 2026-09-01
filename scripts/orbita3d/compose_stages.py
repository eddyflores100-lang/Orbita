"""ÓRBITA · Composición por etapas (para CPUs limitadas).
  python3 compose_stages.py A   → clips 1-5  → output/partA.mp4
  python3 compose_stages.py B   → clips 6-9  → output/partB.mp4
  python3 compose_stages.py C   → A+B + música + fades → salida final"""
import json
import subprocess
import sys

XFADE = 0.5
V = "-c:v libx264 -preset veryfast -crf 17 -pix_fmt yuv420p".split()


def dur_of(clips):
    return [c["duration"] for c in clips]


def xfade_group(files, durs, out, extra_v="", audio=None):
    n = len(files)
    inputs = []
    for f in files:
        inputs += ["-i", f]
    if audio:
        inputs += ["-i", audio]
    filt = []
    prev = "[0:v]"
    off = 0.0
    for i in range(1, n):
        off += durs[i - 1] - XFADE
        lab = f"[v{i}]" if i < n - 1 else "[vx]"
        filt.append(f"{prev}[{i}:v]xfade=transition=fade:duration={XFADE}:offset={off:.3f}{lab}")
        prev = lab
    total = sum(durs) - XFADE * (n - 1)
    pre = extra_v.format(total=total) if extra_v else ""
    cmd = (["ffmpeg", "-y", "-loglevel", "error"] + inputs +
           ["-filter_complex", ";".join(filt) + ("" if not pre else ";" + pre.replace("[IN]", "[vx]"))])
    if audio:
        cmd[-1] += f";[{n}:a]atrim=0:{total:.3f},afade=t=in:st=0:d=1.2,afade=t=out:st={total-3.2:.3f}:d=3.2[aout]"
        cmd += ["-map", "[vout]" if pre else "[vx]", "-map", "[aout]",
                "-c:a", "aac", "-b:a", "192k"]
    else:
        cmd += ["-map", "[vout]" if pre else "[vx]"]
    cmd += V + ["-movflags", "+faststart", out]
    subprocess.run(cmd, check=True)
    print(f"STAGE_OK {out} {total:.2f}s", flush=True)
    return total


def main(mode: str) -> None:
    clips = json.load(open("output/clips.json"))
    if mode == "A":
        xfade_group([c["file"] for c in clips[:5]], dur_of(clips[:5]),
                    "output/partA.mp4")
    elif mode == "B":
        xfade_group([c["file"] for c in clips[5:]], dur_of(clips[5:]),
                    "output/partB.mp4")
    elif mode == "C":
        da = sum(c["duration"] for c in clips[:5]) - XFADE * 4
        db = sum(c["duration"] for c in clips[5:]) - XFADE * 3
        total = da + db - XFADE
        inputs = ["-i", "output/partA.mp4", "-i", "output/partB.mp4", "-i", "output/music.wav"]
        filt = (f"[0:v][1:v]xfade=transition=fade:duration={XFADE}:offset={da - XFADE:.3f}[vx];"
                f"[vx]fade=t=in:st=0:d=0.6,fade=t=out:st={total-0.9:.3f}:d=0.9,"
                f"format=yuv420p[vout];"
                f"[2:a]atrim=0:{total:.3f},afade=t=in:st=0:d=1.2,"
                f"afade=t=out:st={total-3.2:.3f}:d=3.2[aout]")
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error"] + inputs +
                       ["-filter_complex", filt, "-map", "[vout]", "-map", "[aout]",
                        "-c:v", "libx264", "-preset", "medium", "-crf", "18",
                        "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart",
                        sys.argv[2]], check=True)
        print(f"FINAL_OK {sys.argv[2]} {total:.2f}s", flush=True)


if __name__ == "__main__":
    main(sys.argv[1])
