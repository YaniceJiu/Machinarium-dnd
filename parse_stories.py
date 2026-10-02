# -*- coding: utf-8 -*-
"""解析 生命之水_每人每回合行动.docx，生成 js/stories.js（window.STORIES）
结构：
- 简化版：每玩家一张表（回合/地点/做了什么）
- 完整版：每玩家按回合的逐字稿对白块
输出 window.STORIES = { 'playerId@pointId': { concise, full } }
"""
import zipfile, re, json, os
from xml.etree import ElementTree as ET

DOCX = r'C:\Users\janic\Downloads\生命之水_每人每回合行动.docx'
OUT = r'C:\Users\janic\Downloads\编程project\圣状dnd\js\stories.js'

W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'

# 玩家名 -> id
PNAME2ID = {
    '苏联老兵': 'soviet',
    '华尔街之狼': 'wolf',
    '谢特勒': 'shettler',
    '老钟': 'zhong',
    '炼金术士': 'alchemist',
    '猎人': 'hunter',
    '技术工人': 'worker',
    'Sonia': 'sonia',
    '安姐': 'an',
}
# 回合 -> 时间点
ROUND2PT = {
    'D1-R1': '1.1', 'D1-R2': '1.2', 'D1-R3': '1.3',
    'D2-R1': '2.1', 'D2-R2': '2.2',
}

z = zipfile.ZipFile(DOCX)
root = ET.fromstring(z.read('word/document.xml'))
body = root.find(W + 'body')

def para_text(p):
    return ''.join(t.text or '' for t in p.iter(W + 't'))

def row_texts(tr):
    cells = []
    for tc in tr.findall(W + 'tc'):
        ps = [para_text(p) for p in tc.findall(W + 'p')]
        cells.append(''.join(ps).strip())
    return cells

# 遍历 body 子元素
tables = []   # 简化版的表（按顺序）
paras = []    # 全部段落文本（按顺序），用于完整版
for child in body:
    if child.tag == W + 'tbl':
        tables.append(child)
    elif child.tag == W + 'p':
        paras.append(para_text(child))

# ---------- 1. 简化版：从表格提取 (id@pt -> concise) ----------
concise = {}
for tbl in tables:
    rows = [row_texts(tr) for tr in tbl.findall(W + 'tr')]
    rows = [r for r in rows if any(c for c in r)]
    if not rows:
        continue
    header = rows[0]
    # 表头应含 '回合' '地点' '做了什么'
    if not any('回合' in c for c in header):
        continue
    # 找 回合/做了什么 列索引
    col_round = next((i for i, c in enumerate(header) if '回合' in c), None)
    col_do = next((i for i, c in enumerate(header) if '做了什么' in c), None)
    if col_round is None or col_do is None:
        continue
    # 玩家名在表前面的段落里，通过顺序对应：表按玩家顺序排列
    # 用表内第一数据行的回合列判断玩家顺序不可靠；改为按表顺序对应 PNAME2ID 顺序
    pass

# 简化版表与玩家顺序对应：简化版之前有每个玩家的名字段落
# 直接按表顺序与 PNAME2ID 顺序一一对应（docx 里简化版顺序即上面 dict 顺序）
player_order = list(PNAME2ID.keys())
for idx, tbl in enumerate(tables):
    if idx >= len(player_order):
        break
    pid = PNAME2ID[player_order[idx]]
    rows = [row_texts(tr) for tr in tbl.findall(W + 'tr')]
    rows = [r for r in rows if any(c for c in r)]
    header = rows[0]
    col_round = next((i for i, c in enumerate(header) if '回合' in c), None)
    col_do = next((i for i, c in enumerate(header) if '做了什么' in c), None)
    if col_round is None or col_do is None:
        continue
    for r in rows[1:]:
        rnd = r[col_round].strip() if col_round < len(r) else ''
        do = r[col_do].strip() if col_do < len(r) else ''
        pt = ROUND2PT.get(rnd)
        if pt and do:
            concise[f'{pid}@{pt}'] = do

# ---------- 2. 完整版：从段落提取 (id@pt -> full 块) ----------
full = {}
cur_pid = None
cur_pt = None
buf = []  # 当前回合的对白行

def flush():
    global buf
    if cur_pid and cur_pt and buf:
        # 完整版块 = 总结句 + 对白；总结句即第一行（与 concise 相同）
        full[f'{cur_pid}@{cur_pt}'] = '\n'.join(buf)
    buf = []

i = 0
# 定位“完整版”段落
start = None
for idx, t in enumerate(paras):
    if t.strip() == '完整版':
        start = idx + 1
        break

if start is not None:
    for t in paras[start:]:
        s = t.strip()
        if not s:
            continue
        if s in PNAME2ID:
            flush()
            cur_pid = PNAME2ID[s]
            cur_pt = None
            continue
        m = re.match(r'^(D[12]-R[123])\u3000(.*)$', s)
        if m:
            flush()
            cur_pt = ROUND2PT.get(m.group(1))
            # 跳过地点，地点由 POSITIONS 负责
            continue
        if cur_pt:
            buf.append(s)
    flush()

# ---------- 汇总 ----------
stories = {}
for key in sorted(set(list(concise.keys()) + list(full.keys()))):
    stories[key] = {
        'concise': concise.get(key, ''),
        'full': full.get(key, concise.get(key, '')),
    }

# 写 JS
def js_escape(s):
    return s.replace('\\', '\\\\').replace("'", "\\'").replace('\n', '\\n').replace('\r', '')

lines = ['// 自动生成：生命之水_每人每回合行动.docx 剧情（简略版/完整版）', 'window.STORIES = {']
for key in sorted(stories.keys()):
    c = js_escape(stories[key]['concise'])
    f = js_escape(stories[key]['full'])
    lines.append(f"  '{key}': {{")
    lines.append(f"    concise: '{c}',")
    lines.append(f"    full: '{f}',")
    lines.append('  },')
lines.append('};')
with open(OUT, 'w', encoding='utf-8') as fh:
    fh.write('\n'.join(lines) + '\n')

print('concise entries:', len(concise))
print('full entries:', len(full))
print('total stories:', len(stories))
# 打印缺失
miss_c = [k for k in full if k not in concise]
miss_f = [k for k in concise if k not in full]
print('missing concise:', miss_c)
print('missing full:', miss_f)
print('written:', OUT)
