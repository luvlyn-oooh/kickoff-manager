"""앱 아이콘 생성: python dev/make_icons.py  (Pillow 필요)"""
import math
import os
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(__file__), '..', 'icons')
os.makedirs(OUT, exist_ok=True)

BG = (10, 16, 32)
GRASS_A = (61, 138, 63)
GRASS_B = (70, 151, 74)
LINE = (255, 255, 255, 220)
LIME = (163, 230, 53)


def draw_icon(size, pad_ratio, rounded):
    S = size * 4  # 슈퍼샘플링
    img = Image.new('RGBA', (S, S), BG + (255,) if not rounded else (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if rounded:
        d.rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * 0.22), fill=BG + (255,))
    pad = int(S * pad_ratio)
    x0, y0, x1, y1 = pad, pad, S - pad, S - pad
    w = x1 - x0
    # 잔디 (세로 줄무늬)
    pitch = Image.new('RGBA', (w, w), GRASS_A + (255,))
    pd = ImageDraw.Draw(pitch)
    n = 6
    for i in range(n):
        if i % 2:
            pd.rectangle([0, int(i * w / n), w, int((i + 1) * w / n)], fill=GRASS_B + (255,))
    lw = max(2, int(w * 0.022))
    m = int(w * 0.08)
    pd.rectangle([m, m, w - m, w - m], outline=LINE, width=lw)
    pd.line([m, w // 2, w - m, w // 2], fill=LINE, width=lw)
    r = int(w * 0.17)
    pd.ellipse([w // 2 - r, w // 2 - r, w // 2 + r, w // 2 + r], outline=LINE, width=lw)
    bw = int(w * 0.36)
    pd.rectangle([w // 2 - bw // 2, m, w // 2 + bw // 2, m + int(w * 0.14)], outline=LINE, width=lw)
    pd.rectangle([w // 2 - bw // 2, w - m - int(w * 0.14), w // 2 + bw // 2, w - m], outline=LINE, width=lw)
    mask = Image.new('L', (w, w), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, w - 1, w - 1], radius=int(w * 0.16), fill=255)
    img.paste(pitch, (x0, y0), mask)
    # 공
    cx, cy, br = S // 2, S // 2, int(w * 0.13)
    d.ellipse([cx - br + int(br * 0.15), cy - br + int(br * 0.25), cx + br + int(br * 0.15), cy + br + int(br * 0.25)], fill=(0, 0, 0, 90))
    d.ellipse([cx - br, cy - br, cx + br, cy + br], fill=(255, 255, 255, 255), outline=(15, 23, 42, 255), width=max(2, br // 10))
    pr = br * 0.42
    pts = [(cx + pr * math.cos(math.radians(-90 + k * 72)), cy + pr * math.sin(math.radians(-90 + k * 72))) for k in range(5)]
    d.polygon(pts, fill=(15, 23, 42, 255))
    # 라임 포인트 링
    d.arc([cx - br - int(br * 0.35), cy - br - int(br * 0.35), cx + br + int(br * 0.35), cy + br + int(br * 0.35)], 200, 340, fill=LIME + (255,), width=max(3, br // 6))
    return img.resize((size, size), Image.LANCZOS)


draw_icon(192, 0.1, True).save(os.path.join(OUT, 'icon-192.png'))
draw_icon(512, 0.1, True).save(os.path.join(OUT, 'icon-512.png'))
draw_icon(512, 0.2, False).save(os.path.join(OUT, 'icon-maskable-512.png'))
draw_icon(180, 0.12, False).save(os.path.join(OUT, 'apple-touch-icon.png'))
draw_icon(64, 0.06, True).save(os.path.join(OUT, 'favicon.png'))
print('icons written to', os.path.abspath(OUT))
