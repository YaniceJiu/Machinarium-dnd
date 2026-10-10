# -*- coding: utf-8 -*-
"""裁切四款药(2x2)，并把图纸复制到 items/ 用英文名。"""
from PIL import Image
import os, shutil

PROJ = r'C:\Users\janic\Downloads\编程project\圣状dnd'
ITEMS = os.path.join(PROJ, 'items')
os.makedirs(ITEMS, exist_ok=True)

# 1) 四款药 sprite：2x2，每格 768x512
sprite = Image.open(os.path.join(PROJ, '四款药 分开上新.png'))
W, H = sprite.size
cw, ch = W // 2, H // 2
meds = [
    ('herb_revive',   0,    0),    # 起死回生药（左上）
    ('herb_berserk',  cw,   0),    # 狂战士（右上）
    ('herb_poison',   0,    ch),   # 毒药（左下）
    ('herb_heal',     cw,   ch),   # 治疗（右下）
]
for name, x, y in meds:
    crop = sprite.crop((x, y, x + cw, y + ch))
    crop.save(os.path.join(ITEMS, name + '.png'))
    print('crop', name, crop.size)

# 2) 图纸复制为英文名
plans = [
    ('缝纫机.png',   'sewing.png'),
    ('小船发动机.png', 'engine.png'),
    ('手枪.png',     'pistol.png'),
]
for src, dst in plans:
    shutil.copy(os.path.join(PROJ, src), os.path.join(ITEMS, dst))
    print('copy', src, '->', dst)
print('done')
