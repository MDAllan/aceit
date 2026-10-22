"""Makes simple PLACEHOLDER badge pictures (256x256 PNG, transparent background) from badges/badges.json.

Run from anywhere:   python tools/make_badge_placeholders.py
Optional:            python tools/make_badge_placeholders.py --sheet some/folder/sheet.png   (also saves a contact sheet to look at)
                     python tools/make_badge_placeholders.py --only-missing                   (never overwrite a picture that already exists)

Each family gets its own colour. Inside a family the tiers get richer: a plain ring, then a silver ring, then a gold ring,
then a gold double ring with beads. The pictures are in full colour; the app greys them out with CSS while a badge is locked.
They are deliberately simple. Replace them with your own art by saving a PNG with the same file name.
Needs Pillow:  pip install pillow
"""
import colorsys
import json
import math
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
CONFIG = ROOT / "badges" / "badges.json"
OUT = 256          # final size in pixels
SS = 4             # draw 4x bigger, then shrink: smooth edges
S = OUT * SS
FONTS = [
    "C:/Windows/Fonts/arialbd.ttf",
    "C:/Windows/Fonts/arial.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/Library/Fonts/Arial Bold.ttf",
    "arialbd.ttf",
    "DejaVuSans-Bold.ttf",
]


def font(px):
    for f in FONTS:
        try:
            return ImageFont.truetype(f, px)
        except OSError:
            continue
    try:
        return ImageFont.load_default(size=px)
    except TypeError:
        return ImageFont.load_default()


def hls(h, l, s):
    r, g, b = colorsys.hls_to_rgb(h % 1.0, max(0, min(1, l)), max(0, min(1, s)))
    return (round(r * 255), round(g * 255), round(b * 255))


def mix(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def initials(name):
    allw = [w for w in name.split(" ") if w]
    words = [w for w in allw if w[:1].isupper() or w[:1].isdigit()] or allw
    if len(words) == 1:
        return words[0][:2].upper()          # one word: its first two letters
    return "".join(w[0] for w in words[:2]).upper() or "?"


def disc_gradient(d, cx, cy, r, edge, centre):
    """Filled circle that is a little lighter in the middle (concentric circles, light source at the top left)."""
    steps = 60
    for i in range(steps):
        t = i / (steps - 1)                       # 0 at the edge, 1 at the middle
        rr = r * (1 - t * 0.92)
        ox, oy = -r * 0.10 * t, -r * 0.14 * t     # the bright spot sits up and to the left
        d.ellipse([cx + ox - rr, cy + oy - rr, cx + ox + rr, cy + oy + rr], fill=mix(edge, centre, t ** 0.8) + (255,))


def ring(d, cx, cy, r_out, width, colour):
    d.ellipse([cx - r_out, cy - r_out, cx + r_out, cy + r_out], outline=colour + (255,), width=round(width))


def make(family_index, family_count, tier_index, tier_count, name):
    hue = (family_index * 0.618033988749895 + 0.07) % 1.0     # golden-ratio spread: neighbouring families look different
    frac = tier_index / (tier_count - 1) if tier_count > 1 else 1.0
    lvl = round(frac * 3)                                        # 0..3: how rich this tier looks
    cx = cy = S / 2
    R = S * 0.45

    dark = hls(hue, 0.30 - 0.04 * frac, 0.44 + 0.24 * frac)
    light = hls(hue, 0.64 - 0.04 * frac, 0.44 + 0.24 * frac)
    ring_cols = [hls(hue, 0.82, 0.45), (214, 220, 232), (242, 193, 78), (255, 206, 64)]
    rc = ring_cols[lvl]
    rc_dark = mix(rc, (60, 50, 40), 0.35)

    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))

    # soft shadow under the badge
    sh = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(sh).ellipse([cx - R, cy - R + S * 0.025, cx + R, cy + R + S * 0.025], fill=(20, 24, 50, 90))
    img.alpha_composite(sh.filter(ImageFilter.GaussianBlur(S * 0.012)))

    d = ImageDraw.Draw(img)
    # outer rim (the ring colour), then the coloured disc inside it
    d.ellipse([cx - R, cy - R, cx + R, cy + R], fill=rc_dark + (255,))
    rim = S * (0.018 + 0.004 * lvl)
    d.ellipse([cx - R + rim, cy - R + rim, cx + R - rim, cy + R - rim], fill=rc + (255,))
    band = S * (0.030 + 0.010 * lvl)
    disc_r = R - rim - band
    disc_gradient(d, cx, cy, disc_r, dark, light)

    # inner decoration grows with the tier
    ring(d, cx, cy, disc_r - S * 0.012, S * 0.006, mix(rc, light, 0.25))
    if lvl >= 2:
        ring(d, cx, cy, disc_r - S * 0.042, S * 0.006, rc)
    if lvl >= 3:
        for k in range(16):
            a = k * 2 * math.pi / 16
            px, py = cx + (R - rim - band / 2) * math.cos(a), cy + (R - rim - band / 2) * math.sin(a)
            pr = S * 0.0085
            d.ellipse([px - pr, py - pr, px + pr, py + pr], fill=(255, 255, 255, 235))

    # first letters, white with a soft shadow
    txt = initials(name)
    f = font(round(S * (0.30 if len(txt) < 2 else 0.27)))
    d.text((cx + S * 0.006, cy - S * 0.03 + S * 0.008), txt, font=f, fill=(0, 0, 0, 70), anchor="mm")
    d.text((cx, cy - S * 0.03), txt, font=f, fill=(255, 255, 255, 255), anchor="mm")

    # tier number in a small round tag at the bottom
    tr = S * 0.085
    ty = cy + R * 0.78
    d.ellipse([cx - tr, ty - tr, cx + tr, ty + tr], fill=mix(dark, (0, 0, 0), 0.25) + (255,), outline=rc + (255,), width=round(S * 0.008))
    d.text((cx, ty), str(tier_index + 1), font=font(round(S * 0.095)), fill=(255, 255, 255, 255), anchor="mm")

    return img.resize((OUT, OUT), Image.LANCZOS)


def save_small(img, path):
    """256 colours + transparency keeps each file small (the gradients stay smooth enough at this size)."""
    q = img.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
    alpha = bytearray(q.getpalette("RGBA")[3::4])    # one transparency value per palette colour
    alpha += bytes([255]) * (256 - len(alpha))
    for i, a in enumerate(alpha):
        if a < 3:                                    # the quantizer leaves the background almost, not fully, transparent
            alpha[i] = 0
    q.save(path, optimize=True, transparency=bytes(alpha))


def main():
    args = sys.argv[1:]
    only_missing = "--only-missing" in args
    sheet = args[args.index("--sheet") + 1] if "--sheet" in args else None
    cfg = json.loads(CONFIG.read_text(encoding="utf-8"))
    made = []
    for fi, fam in enumerate(cfg["families"]):
        n = len(fam["tiers"])
        for ti, tier in enumerate(fam["tiers"]):
            path = ROOT / tier["image"]
            path.parent.mkdir(parents=True, exist_ok=True)
            img = make(fi, len(cfg["families"]), ti, n, tier["name"])
            if not (only_missing and path.exists()):
                save_small(img, path)
            made.append((img, tier["name"]))
    print(f"wrote {len(made)} placeholder pictures into {ROOT / 'badges' / 'img'}")
    if sheet:
        cols, cell = 8, 150
        rows = (len(made) + cols - 1) // cols
        im = Image.new("RGBA", (cols * cell, rows * (cell + 22)), (245, 246, 247, 255))
        dr = ImageDraw.Draw(im)
        small = font(13)
        for i, (pic, nm) in enumerate(made):
            x, y = (i % cols) * cell, (i // cols) * (cell + 22)
            im.alpha_composite(pic.resize((cell - 10, cell - 10), Image.LANCZOS), (x + 5, y + 2))
            dr.text((x + cell / 2, y + cell + 8), nm, font=small, fill=(30, 37, 71, 255), anchor="mm")
        Path(sheet).parent.mkdir(parents=True, exist_ok=True)
        im.save(sheet)
        print("contact sheet:", sheet)


if __name__ == "__main__":
    main()
