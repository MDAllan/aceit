"""Still pictures for animations: every animated .webp under img/ gets a <name>.still.webp (its last frame, the labelled
summary frame) and js/stills.js lists them, so phones set to "reduce motion" see a still picture instead of the animation.
   python tools/build_stills.py          # write any missing stills and js/stills.js
   python tools/build_stills.py --check  # exit 1 if a still or the list is missing or out of date (used by npm run check)"""
import glob, os, sys

root = os.path.join(os.path.dirname(__file__), "..")
os.chdir(root)
check = "--check" in sys.argv


def animated(path):
    with open(path, "rb") as f:
        head = f.read(64)
    return head[:4] == b"RIFF" and head[8:12] == b"WEBP" and b"VP8X" in head and bool(head[20] & 0x02)


srcs, problems = [], []
for p in sorted(glob.glob("img/**/*.webp", recursive=True)):
    p = p.replace("\\", "/")
    if p.endswith(".still.webp") or not animated(p):
        continue
    srcs.append(p)
    still = p[:-5] + ".still.webp"
    if check:  # file dates are not kept by git, so the check only asks that the still exists
        if not os.path.exists(still):
            problems.append(f"{still} is missing")
        continue
    if os.path.exists(still) and os.path.getmtime(still) >= os.path.getmtime(p):
        continue
    from PIL import Image  # only needed to make stills, so the check runs without Pillow
    im = Image.open(p)
    im.seek(im.n_frames - 1)
    im.convert("RGBA").save(still, "WEBP", quality=82, method=6)
    print("wrote", still)

for s in sorted(glob.glob("img/**/*.still.webp", recursive=True)):
    if s.replace("\\", "/")[:-11] + ".webp" not in srcs:
        problems.append(f"{s} has no animation next to it") if check else (os.remove(s), print("removed", s))

text = ("// Made by tools/build_stills.py: the animated pictures that have a still copy (<name>.still.webp) for reduced motion.\n"
        "export const STILLS = new Set(" + str(srcs).replace("'", '"') + ");\n")
cur = open("js/stills.js", encoding="utf8").read() if os.path.exists("js/stills.js") else ""
if cur != text:
    if check:
        problems.append("js/stills.js is out of date")
    else:
        open("js/stills.js", "w", encoding="utf8", newline="\n").write(text)
        print("wrote js/stills.js")
if problems:
    print("\n".join(problems) + "\nRun: python tools/build_stills.py")
    sys.exit(1)
print("stills ok:", len(srcs), "animations")
