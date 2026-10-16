# -*- coding: utf-8 -*-
"""Generate seasonal + time-of-day variants of the StagwithyouFerns background by colour grading.
Plants (green regions) get a selective hue shift; the whole frame gets a light-colour tint.
Output size is locked to the first reference image (1376x768)."""
import numpy as np
from PIL import Image

SRC_DAY = '/sessions/pensive-jolly-meitner/mnt/uploads/IMG_3650.PNG'   # 白天版
SRC_NIGHT = '/sessions/pensive-jolly-meitner/mnt/uploads/IMG_3651.png' # 夜晚版(第一張,基準尺寸)
OUT = '/sessions/pensive-jolly-meitner/mnt/outputs/bg/'
import os; os.makedirs(OUT, exist_ok=True)

TARGET = Image.open(SRC_NIGHT).size  # (1376, 768)

def load(p):
    im = Image.open(p).convert('RGB')
    if im.size != TARGET:
        im = im.resize(TARGET, Image.LANCZOS)
    return np.asarray(im).astype(np.float32) / 255.0

def rgb2hsv(rgb):
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    mx = rgb.max(-1); mn = rgb.min(-1); d = mx - mn
    m = d > 1e-6
    dd = np.where(m, d, 1)
    rc = (mx - r) / dd; gc = (mx - g) / dd; bc = (mx - b) / dd
    h = np.where(mx == r, bc - gc, np.where(mx == g, 2.0 + rc - bc, 4.0 + gc - rc))
    h = (h / 6.0) % 1.0
    h = np.where(m, h, 0)
    s = np.where(mx > 1e-6, d / np.where(mx > 1e-6, mx, 1), 0)
    return h, s, mx

def hsv2rgb(h, s, v):
    i = np.floor(h * 6).astype(int) % 6
    f = h * 6 - np.floor(h * 6)
    p = v * (1 - s); q = v * (1 - s * f); t = v * (1 - s * (1 - f))
    r = np.choose(i, [v, q, p, p, t, v]); g = np.choose(i, [t, v, v, q, p, p]); b = np.choose(i, [p, p, t, v, v, q])
    return np.stack([r, g, b], -1)

def plant_mask(h, s, v, H, W):
    """Soft mask of green foliage. Weaker in the bottom-left cactus zone (cacti stay greener)."""
    hd = h * 360
    core = np.clip(1 - np.abs(hd - 100) / 78.0, 0, 1)          # green band ~22..178 deg (incl. pale sage)
    m = core * np.clip((s - 0.05) / 0.16, 0, 1) * np.clip((v - 0.08) / 0.18, 0, 1)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    # soft-edged cactus zone (bottom-left): keep cacti greener; feathered so no hard seam
    sx = np.clip((W * 0.44 - xx) / (W * 0.08), 0, 1)   # 1 when x < 0.36W, 0 when x > 0.44W
    sy = np.clip((yy - H * 0.63) / (H * 0.08), 0, 1)   # 0 when y < 0.63H, 1 when y > 0.71H
    w = 1.0 - 0.65 * sx * sy
    return m * w

def shift_plants(rgb, target_hue_deg, hue_strength, sat_mul, val_mul):
    h, s, v = rgb2hsv(rgb)
    H, W = h.shape
    m = plant_mask(h, s, v, H, W)
    th = target_hue_deg / 360.0
    dh = ((th - h + 0.5) % 1.0) - 0.5          # shortest-path hue delta
    h2 = (h + dh * hue_strength * m) % 1.0
    s2 = np.clip(s * (1 + (sat_mul - 1) * m), 0, 1)
    v2 = np.clip(v * (1 + (val_mul - 1) * m), 0, 1)
    return hsv2rgb(h2, s2, v2)

def tint(rgb, color, alpha):
    c = np.array(color, dtype=np.float32) / 255.0
    return rgb * (1 - alpha) + c * alpha
def brightness(rgb, k): return np.clip(rgb * k, 0, 1)
def contrast(rgb, k): return np.clip((rgb - 0.5) * k + 0.5, 0, 1)
def saturation(rgb, k):
    g = rgb @ np.array([0.299, 0.587, 0.114], dtype=np.float32)
    return np.clip(g[..., None] + (rgb - g[..., None]) * k, 0, 1)
def lift(rgb, k): return np.clip(rgb * (1 - k) + k, 0, 1)

def save(rgb, name):
    im = Image.fromarray((np.clip(rgb, 0, 1) * 255 + 0.5).astype(np.uint8))
    assert im.size == TARGET
    im.save(OUT + name + '.jpg', quality=93, subsampling=0)
    print('saved', name, im.size)

day = load(SRC_DAY)

# ---------- 季節 ----------
spring = shift_plants(day, 82, 0.55, 1.12, 1.08)
spring = tint(spring, (255, 225, 200), 0.05); spring = brightness(spring, 1.03)
save(spring, '01_spring_春')

summer = shift_plants(day, 118, 0.45, 1.25, 1.00)
summer = contrast(summer, 1.05); summer = tint(summer, (210, 240, 255), 0.03)
save(summer, '02_summer_夏')

autumn = shift_plants(day, 26, 1.0, 1.35, 0.92)
autumn = tint(autumn, (255, 165, 70), 0.12); autumn = contrast(autumn, 1.04)
save(autumn, '03_autumn_秋')

winter = shift_plants(day, 30, 1.0, 0.62, 0.80)
winter = saturation(winter, 0.82); winter = tint(winter, (175, 195, 228), 0.11)
winter = brightness(winter, 0.94); winter = lift(winter, 0.04)
save(winter, '04_winter_冬')

# ---------- 時段 ----------
dawn = tint(day, (255, 190, 170), 0.14); dawn = lift(dawn, 0.06); dawn = saturation(dawn, 0.9); dawn = contrast(dawn, 0.95)
save(dawn, '11_dawn_清晨')

noon = contrast(brightness(day, 1.04), 1.04); noon = saturation(noon, 1.05)
save(noon, '12_noon_正午')

dusk = tint(day, (255, 140, 60), 0.18); dusk = brightness(dusk, 0.92); dusk = contrast(dusk, 1.08)
dusk = np.clip(dusk ** 1.12, 0, 1)
save(dusk, '13_dusk_黃昏')

night_g = tint(day, (22, 42, 92), 0.40); night_g = brightness(night_g, 0.64); night_g = saturation(night_g, 0.78)
night_g = np.clip(night_g ** 1.10, 0, 1); night_g = lift(night_g, 0.025)
save(night_g, '14_night_夜晚分級版')

names = ['01_spring_春','02_summer_夏','03_autumn_秋','04_winter_冬','11_dawn_清晨','12_noon_正午','13_dusk_黃昏','14_night_夜晚分級版']
thumbs = [Image.open(OUT + n + '.jpg').resize((688, 384), Image.LANCZOS) for n in names]
sheet = Image.new('RGB', (688 * 4, 384 * 2), (0, 0, 0))
for k, t in enumerate(thumbs):
    sheet.paste(t, ((k % 4) * 688, (k // 4) * 384))
sheet.save(OUT + '_contact_sheet.jpg', quality=88)
print('contact sheet done')
