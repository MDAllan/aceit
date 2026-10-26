"""Makes simple PLACEHOLDER badge pictures (256x256 PNG, transparent background) from badges/badges.json.

Run from anywhere:   python tools/make_badge_placeholders.py
Optional:            python tools/make_badge_placeholders.py --sheet some/folder/sheet.png   (also saves a contact sheet to look at)
                     python tools/make_badge_placeholders.py --only-missing                   (never overwrite a picture that already exists)

Every tier gets the colour of its material: Bronze, Silver, Gold, Emerald, Diamond, Ruby, Celestial, Legendary (a family with a single
tier is gold). Inside the disc: the first letters of the badge name and a small tier number. Hot Streak is a flame instead, and the flame
gets bigger and brighter at every step. The pictures are in full colour; the app greys them out with CSS while a badge is locked.
They are deliberately simple. Replace them with your own art by saving a PNG with the same file name.
Needs Pillow:  pip install pillow
"""
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
TIERS = ["Bronze", "Silver", "Gold", "Emerald", "Diamond", "Ruby", "Celestial", "Legendary"]
# material -> (rim, disc edge, disc centre)
MATERIALS = {
    "Bronze": ((120, 72, 34), (160, 92, 40), (226, 160, 98)),
    "Silver": ((120, 130, 148), (150, 160, 178), (232, 237, 246)),
    "Gold": ((168, 112, 12), (212, 152, 24), (255, 218, 98)),
    "Emerald": ((10, 84, 60), (18, 128, 92), (92, 220, 156)),
    "Diamond": ((60, 124, 170), (96, 174, 222), (214, 246, 255)),
    "Ruby": ((110, 8, 36), (170, 20, 60), (246, 100, 128)),
    "Celestial": ((40, 32, 120), (74, 62, 176), (160, 140, 255)),
    "Legendary": ((92, 24, 130), (150, 52, 190), (255, 178, 70)),
}


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


def mix(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


# families whose first letters would look the same as another family's
INITIALS = {"brain-bank": "BR", "champion": "CP", "class-conqueror": "CQ", "card-shark": "CS"}


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


def material(tier_index, tier_count):
    return MATERIALS["Gold" if tier_count == 1 else TIERS[min(tier_index, len(TIERS) - 1)]]


def bez(p0, p1, p2, p3, n=18):
    pts = []
    for i in range(n + 1):
        t = i / n
        u = 1 - t
        pts.append((u ** 3 * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t ** 3 * p3[0],
                    u ** 3 * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t ** 3 * p3[1]))
    return pts


# one flame in a 0..1 box (y grows downwards): a rounded bottom and a curling tip
FLAME = (bez((0.50, 1.00), (0.14, 1.00), (0.02, 0.66), (0.28, 0.42))
         + bez((0.28, 0.42), (0.30, 0.26), (0.42, 0.14), (0.52, 0.00))[1:]
         + bez((0.52, 0.00), (0.60, 0.20), (0.70, 0.30), (0.74, 0.46))[1:]
         + bez((0.74, 0.46), (0.82, 0.38), (0.86, 0.34), (0.88, 0.36))[1:]
         + bez((0.88, 0.36), (1.00, 0.56), (0.98, 0.84), (0.84, 0.93))[1:]
         + bez((0.84, 0.93), (0.74, 1.00), (0.62, 1.00), (0.50, 1.00))[1:])


def flame(d, cx, base_y, h, w, colour):
    """Draws the flame so its bottom centre is at (cx, base_y), h tall and w wide."""
    d.polygon([(cx + (x - 0.5) * w, base_y - (1 - y) * h) for x, y in FLAME], fill=colour + (255,))


def shadow(img, cx, cy, R):
    sh = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(sh).ellipse([cx - R, cy - R + S * 0.025, cx + R, cy + R + S * 0.025], fill=(20, 24, 50, 90))
    img.alpha_composite(sh.filter(ImageFilter.GaussianBlur(S * 0.012)))


def make_streak(tier_index, tier_count):
    """Hot Streak: the flame grows and gets brighter with every tier (dark ember, orange, yellow, white-hot with sparks)."""
    frac = tier_index / (tier_count - 1) if tier_count > 1 else 1.0
    cx = cy = S / 2
    R = S * 0.45
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    shadow(img, cx, cy, R)
    d = ImageDraw.Draw(img)
    rim = mix((150, 70, 20), (255, 214, 90), frac)
    d.ellipse([cx - R, cy - R, cx + R, cy + R], fill=mix(rim, (40, 20, 10), 0.4) + (255,))
    d.ellipse([cx - R + S * 0.02, cy - R + S * 0.02, cx + R - S * 0.02, cy + R - S * 0.02], fill=rim + (255,))
    disc_r = R - S * (0.04 + 0.01 * frac)
    disc_gradient(d, cx, cy, disc_r, (26, 22, 52), mix((52, 36, 78), (96, 52, 70), frac))
    # a glow behind the flame that grows with the tier
    glow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    gr = disc_r * (0.30 + 0.62 * frac)
    ImageDraw.Draw(glow).ellipse([cx - gr, cy - gr * 0.9, cx + gr, cy + gr * 1.1], fill=mix((255, 110, 30), (255, 220, 120), frac) + (int(60 + 120 * frac),))
    img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(S * 0.04)))
    d = ImageDraw.Draw(img)
    h = disc_r * (0.62 + 0.80 * frac)           # a small flame at the first step, a tall one at the last
    w = h * 0.78
    base = cy + disc_r * 0.60
    flame(d, cx, base, h, w, mix((196, 52, 18), (255, 96, 24), frac))                               # outer: red to orange
    flame(d, cx, base - h * 0.02, h * 0.80, w * 0.78, mix((255, 140, 30), (255, 196, 40), frac))   # middle: orange to yellow
    flame(d, cx, base - h * 0.04, h * 0.52, w * 0.52, mix((255, 210, 80), (255, 255, 230), frac))  # core: yellow to white-hot
    if tier_index >= 3:                         # sparks above the flame from the 4th step on
        for k in range(min(8, 1 + (tier_index - 3))):
            a = -math.pi / 2 + (k - 3) * 0.42
            r = disc_r * (0.84 + 0.04 * (k % 3))
            px, py = cx + r * math.cos(a), cy + r * math.sin(a) * 0.95
            pr = S * (0.010 + 0.002 * (k % 3))
            d.ellipse([px - pr, py - pr, px + pr, py + pr], fill=(255, 238, 170, 255))
    # the step number in a small round tag at the bottom
    tr = S * 0.10
    ty = cy + R * 0.80
    d.ellipse([cx - tr, ty - tr, cx + tr, ty + tr], fill=(30, 22, 52, 255), outline=rim + (255,), width=round(S * 0.008))
    d.text((cx, ty), str(tier_index + 1), font=font(round(S * 0.10)), fill=(255, 255, 255, 255), anchor="mm")
    return img.resize((OUT, OUT), Image.LANCZOS)


def make(family_id, tier_index, tier_count, name):
    name = INITIALS.get(family_id, name)
    if family_id == "hot-streak":
        return make_streak(tier_index, tier_count)
    rim_c, edge, centre = material(tier_index, tier_count)
    frac = tier_index / (tier_count - 1) if tier_count > 1 else 1.0
    lvl = round(frac * 3)                                        # 0..3: how rich this tier looks
    cx = cy = S / 2
    R = S * 0.45
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    shadow(img, cx, cy, R)

    d = ImageDraw.Draw(img)
    d.ellipse([cx - R, cy - R, cx + R, cy + R], fill=rim_c + (255,))
    rim = S * (0.018 + 0.004 * lvl)
    d.ellipse([cx - R + rim, cy - R + rim, cx + R - rim, cy + R - rim], fill=mix(rim_c, edge, 0.55) + (255,))
    band = S * (0.030 + 0.010 * lvl)
    disc_r = R - rim - band
    disc_gradient(d, cx, cy, disc_r, edge, centre)

    # inner decoration grows with the tier
    ring(d, cx, cy, disc_r - S * 0.012, S * 0.006, mix(centre, (255, 255, 255), 0.35))
    if lvl >= 2:
        ring(d, cx, cy, disc_r - S * 0.042, S * 0.006, mix(edge, (255, 255, 255), 0.5))
    if lvl >= 3:
        for k in range(16):
            a = k * 2 * math.pi / 16
            px, py = cx + (R - rim - band / 2) * math.cos(a), cy + (R - rim - band / 2) * math.sin(a)
            pr = S * 0.0085
            d.ellipse([px - pr, py - pr, px + pr, py + pr], fill=(255, 255, 255, 235))
    if tier_count > 1 and tier_index >= 6:               # Celestial and Legendary: a few stars around the disc
        for k in range(5):
            a = -math.pi / 2 + k * 2 * math.pi / 5
            px, py = cx + R * math.cos(a) * 0.98, cy + R * math.sin(a) * 0.98
            pr = S * 0.026
            q = pr * 0.32
            d.polygon([(px, py - pr), (px + q, py - q), (px + pr, py), (px + q, py + q), (px, py + pr), (px - q, py + q), (px - pr, py), (px - q, py - q)], fill=(255, 244, 190, 255))

    # first letters: white with a soft shadow (dark on the light silver and diamond discs)
    txt = initials(name)
    light = sum(centre) > 640
    f = font(round(S * (0.30 if len(txt) < 2 else 0.27)))
    d.text((cx + S * 0.006, cy - S * 0.03 + S * 0.008), txt, font=f, fill=(255, 255, 255, 90) if light else (0, 0, 0, 70), anchor="mm")
    d.text((cx, cy - S * 0.03), txt, font=f, fill=(34, 44, 84, 255) if light else (255, 255, 255, 255), anchor="mm")

    # tier number in a small round tag at the bottom (not for a single badge)
    if tier_count > 1:
        tr = S * 0.085
        ty = cy + R * 0.78
        d.ellipse([cx - tr, ty - tr, cx + tr, ty + tr], fill=mix(edge, (0, 0, 0), 0.45) + (255,), outline=mix(centre, (255, 255, 255), 0.3) + (255,), width=round(S * 0.008))
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
    for fam in cfg["families"]:
        n = len(fam["tiers"])
        for ti, tier in enumerate(fam["tiers"]):
            path = ROOT / tier["image"]
            path.parent.mkdir(parents=True, exist_ok=True)
            label = tier.get("name") or (TIERS[ti] if n > 1 and ti < len(TIERS) else "")
            img = make(fam["id"], ti, n, fam["name"])
            if not (only_missing and path.exists()):
                save_small(img, path)
            made.append((img, (fam["name"] + " " + label).strip()))
    print(f"wrote {len(made)} placeholder pictures into {ROOT / 'badges' / 'img'}")
    if sheet:
        cols, cell = 10, 112
        rows = (len(made) + cols - 1) // cols
        im = Image.new("RGBA", (cols * cell, rows * (cell + 22)), (245, 246, 247, 255))
        dr = ImageDraw.Draw(im)
        small = font(11)
        for i, (pic, nm) in enumerate(made):
            x, y = (i % cols) * cell, (i // cols) * (cell + 22)
            im.alpha_composite(pic.resize((cell - 10, cell - 10), Image.LANCZOS), (x + 5, y + 2))
            dr.text((x + cell / 2, y + cell + 8), nm[:20], font=small, fill=(30, 37, 71, 255), anchor="mm")
        Path(sheet).parent.mkdir(parents=True, exist_ok=True)
        im.save(sheet)
        print("contact sheet:", sheet)


if __name__ == "__main__":
    main()
