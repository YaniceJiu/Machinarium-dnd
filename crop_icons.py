# -*- coding: utf-8 -*-
"""把 地点图标.png 里的 9 个建筑裁成独立 PNG，并把白底转透明。
裁剪框来自对 地点图标.png 的像素分析（已排除底部红色中文标签）。
"""
from PIL import Image
import numpy as np
from collections import deque
import os

BASE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(BASE, "地点图标.png")
OUT = os.path.join(BASE, "icons")
os.makedirs(OUT, exist_ok=True)

# id -> (x, y, w, h)  底部已收在红色中文标签上方，避免文字边缘混入
CROPS = [
    ("rest",    44, 181, 310, 145),
    ("bar",    397, 126, 255, 204),
    ("factory", 702, 110, 316, 219),
    ("dock",  1081, 144, 336, 187),
    ("prison", 1455, 135, 275, 194),
    ("finance",  40, 488, 401, 238),
    ("gov",    489, 478, 399, 250),
    ("bc",     905, 515, 426, 215),
    ("church", 1362, 463, 371, 271),
]

PAD = 3  # 每边留 3px 安全边距

src = Image.open(SRC).convert("RGB")

def crop_with_transparent_bg(x, y, w, h):
    x0 = max(0, x - PAD); y0 = max(0, y - PAD)
    x1 = min(src.width, x + w + PAD); y1 = min(src.height, y + h + PAD)
    rgb = np.array(src.crop((x0, y0, x1, y1)))
    hh, ww = rgb.shape[:2]
    # 白底判定：三通道都 >240
    white = rgb.min(axis=2) > 240
    alpha = np.full((hh, ww), 255, dtype=np.uint8)
    # 从边界 flood-fill，只把与边界连通的白色区域变透明
    seen = np.zeros((hh, ww), dtype=bool)
    stack = deque()
    for i in range(hh):
        for j in (0, ww - 1):
            if white[i, j] and not seen[i, j]:
                seen[i, j] = True; stack.append((i, j))
    for j in range(ww):
        for i in (0, hh - 1):
            if white[i, j] and not seen[i, j]:
                seen[i, j] = True; stack.append((i, j))
    while stack:
        i, j = stack.popleft()
        alpha[i, j] = 0
        for di, dj in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            ni, nj = i + di, j + dj
            if 0 <= ni < hh and 0 <= nj < ww and white[ni, nj] and not seen[ni, nj]:
                seen[ni, nj] = True
                stack.append((ni, nj))
    out = Image.fromarray(rgb).convert("RGBA")
    out.putalpha(Image.fromarray(alpha))
    return out

for name, x, y, w, h in CROPS:
    img = crop_with_transparent_bg(x, y, w, h)
    path = os.path.join(OUT, f"{name}.png")
    img.save(path)
    print(f"saved {path}  {img.width}x{img.height}")

print("done")
