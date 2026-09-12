#!/usr/bin/env python3
"""slide-studio / テーマの可読性検査。

    python3 scripts/check_contrast.py assets/themes/navy.json
    python3 scripts/check_contrast.py out.manifest.json        # 生成後の実 palette
    node scripts/brand_theme.js default 0055A4 > /tmp/b.json && python3 scripts/check_contrast.py /tmp/b.json

利用者が指定した色を勝手に変えるのではなく、**使い方を変える**ための判定を出す。
コントラスト比が足りない色は、面（塗り）ではなく線と文字に用途を限定する。
"""
import json
import sys

PAIRS = [
    ("primary", "paper", 4.5, "本文・見出しの主色"),
    ("secondary", "paper", 4.5, "副色（主題の強調）"),
    ("body", "paper", 4.5, "本文"),
    ("textMuted", "paper", 3.0, "注記・フッタ"),
    ("inverse", "primary", 4.5, "主色の上に載る文字"),
    ("secondary", "secondaryPale", 4.5, "副色の淡色面に載る文字"),
    ("coverText", "coverBg", 4.5, "表紙の題名"),
    ("coverFaint", "coverBg", 3.0, "表紙の注記"),
    ("secondary", "coverBg", 3.0, "表紙の eyebrow と罫"),
]


def lum(hexstr):
    h = hexstr.lstrip("#")
    ch = []
    for i in (0, 2, 4):
        c = int(h[i:i + 2], 16) / 255.0
        ch.append(c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4)
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2]


def ratio(a, b):
    la, lb = lum(a), lum(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def used_fills(t):
    """manifest.json なら、実際に塗りに使った色役割の集合を返す。テーマ JSON なら None。"""
    if "slides" not in t:
        return None
    fills = {"paper"}
    for sl in t["slides"]:
        for it in sl.get("items", []):
            if it.get("kind") == "rect" and it.get("fill"):
                fills.add(it["fill"])
    if t.get("palette", {}).get("coverBg"):
        fills.add("coverBg")
    return fills


def check(path):
    t = json.load(open(path, encoding="utf-8"))
    p = t["palette"]
    fills = used_fills(t)
    label = f"theme={t.get('theme') or t.get('name')}" + (f"  brand={t['brand']}" if t.get("brand") else f"  ({t.get('label','')})")
    print(f"\n{path}  {label}")
    fails = 0
    for fg, bg, need, why in PAIRS:
        if fg not in p or bg not in p:
            continue
        r = ratio(p[fg], p[bg])
        ok = r >= need
        if not ok and fills is not None and bg not in fills:
            # 面として一度も塗っていない組は、規約どおり線と文字に限定できている
            print(f"  skip {fg:14s} on {bg:14s} {r:5.2f} (要 {need})  {why} — この面は未使用")
            continue
        print(f"  {'ok  ' if ok else 'FAIL'} {fg:14s} on {bg:14s} {r:5.2f} (要 {need})  {why}")
        if not ok:
            fails += 1
    for k, v in p.items():
        if v.startswith("#") or len(v) not in (6,):
            print(f"  FAIL 色の書式が不正: {k}={v}  （# を付けない・6 桁 hex のみ）")
            fails += 1
    if fails:
        print(f"\n  → {fails} 件。不足した色は面では使わず、線と文字に限定する。")
        print("     利用者に理由を伝えたうえで運用を変える。色そのものを黙って差し替えない。")
    else:
        print("\n  → 可読性は基準を満たす")
    return fails


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    sys.exit(1 if sum(check(a) for a in sys.argv[1:]) else 0)
