#!/usr/bin/env python3
"""slide-studio / レンダリング前の静的レイアウト検査。

    python3 scripts/check_layout.py out.manifest.json

deck.lib.js が書き出したレイアウト台帳を読み、描画せずに検出できる崩れを潰す。
前回の実測では、目視で見つけた 9 件の不具合のうち 6 件がこの段階で検出できる性質だった。
ここで落とせれば、目視は「機械に見えないもの」だけに集中できる。

検出できないもの（目視に残すもの）:
  余白の偏り／視線の流れ／グラフ表現の適否／数値主張とグラフの一致
"""
import json
import re
import sys

ERR, WARN = "ERROR", "WARN"

# 全角判定（deck.lib.js の isFullWidth と同じ定義に揃えること）
FW_RANGES = [
    (0x1100, 0x115F), (0x2E80, 0xA4CF), (0xAC00, 0xD7A3), (0xF900, 0xFAFF),
    (0xFE30, 0xFE6F), (0xFF00, 0xFF60), (0xFFE0, 0xFFE6), (0x20000, 0x3FFFD),
]

# 体言止め検出用。文末がこの集合ならば用言で終わっているとみなす
YOUGEN_TAIL = set("るたういくすつぬぶむぐずじきしちにびみりえけせてねへめれげでべろよなんだ")


def is_fw(ch):
    c = ord(ch)
    return any(a <= c <= b for a, b in FW_RANGES)


def text_w(s, size, type_):
    em = size / 72.0
    w = 0.0
    for ch in s:
        if ch == "\n":
            continue
        w += em * (type_["fullWidthEm"] if is_fw(ch) else type_["halfWidthEm"])
    return w * type_["safety"]


def est_lines(s, size, box_w, type_):
    if box_w <= 0:
        return 999
    import math
    total = 0
    for ln in s.split("\n"):
        total += max(1, math.ceil(text_w(ln, size, type_) / box_w))
    return total


def rects_overlap(a, b, tol=0.02):
    return not (
        a["x"] + a["w"] - tol <= b["x"]
        or b["x"] + b["w"] - tol <= a["x"]
        or a["y"] + a["h"] - tol <= b["y"]
        or b["y"] + b["h"] - tol <= a["y"]
    )


def check(path):
    m = json.load(open(path, encoding="utf-8"))
    grid, type_, rules = m["grid"], m["type"], m.get("rules", {})
    issues = []

    seen = set()

    def add(level, slide_no, msg, detail=""):
        key = (level, slide_no, msg, detail)
        if key in seen:
            return
        seen.add(key)
        issues.append(key)

    seen_pages = []
    for sl in m["slides"]:
        no = sl["no"]
        seen_pages.append(no)
        items = sl["items"]
        texts = [i for i in items if i["kind"] == "text" and i.get("w")]

        # --- 1. 出典が空でないか（表紙は除く） ------------------------------
        if no > 1:
            if not (sl.get("source") or "").strip():
                add(ERR, no, "フッタの出典が空", f"title={sl.get('title')}")

        # --- 2. ヘッドメッセージが結論文になっているか ----------------------
        head = (sl.get("head") or "").strip()
        if no > 1 and head:
            tail = head.rstrip("。｡ ").strip()
            if tail and tail[-1] not in YOUGEN_TAIL:
                add(WARN, no, "ヘッドメッセージが体言止めの可能性",
                    f'"{head[-16:]}" — 述語で終える')
            if head.count("。") >= 2 and len(head) > 60:
                add(WARN, no, "ヘッドメッセージに論点が2つ以上ある可能性", "1枚1メッセージを確認")

        # --- 3. 文字のはみ出し ---------------------------------------------
        for t in texts:
            if t.get("noWrapCheck"):
                # 1 行前提の短い注記。横幅だけ見る
                w = text_w(t["text"], t["size"], type_)
                if w > t["w"] * 1.35:
                    add(WARN, no, "1行想定のテキストが枠を大きく超える",
                        f'"{t["text"][:24]}" 推定{w:.2f}in > 枠{t["w"]:.2f}in')
                continue
            lines = est_lines(t["text"], t["size"], t["w"], type_)
            need = lines * (t["size"] / 72.0) * type_["lineFactor"]
            if need > t["h"] + 0.02:
                add(ERR, no, "テキストが枠の高さを超える",
                    f'"{t["text"][:24]}" {lines}行 必要{need:.2f}in > 枠{t["h"]:.2f}in')

        # --- 4. スライド境界・本文領域からの逸脱 ----------------------------
        for it in items:
            if it.get("x") is None:
                continue
            if it["x"] < grid["margin"] - 0.03 or it["x"] + it["w"] > grid["slideW"] - grid["margin"] + 0.03:
                add(ERR, no, "要素が左右の余白を侵している",
                    f'{it["kind"]} x={it["x"]:.2f} w={it["w"]:.2f}')
            if no > 1 and it["group"] not in ("hdr-title", "hdr-head", "footer"):
                if it["y"] < grid["bodyTop"] - 0.06:
                    add(ERR, no, "要素がヘッドメッセージ領域に食い込んでいる", f'y={it["y"]:.2f}')
                if it["y"] + it["h"] > grid["footRuleY"] - 0.04:
                    add(ERR, no, "要素がフッタに食い込んでいる",
                        f'{it["kind"]} 下端={it["y"]+it["h"]:.2f} > {grid["footRuleY"]-0.04:.2f}')

        # --- 5. テキスト同士の衝突（別グループ間のみ） ----------------------
        for i in range(len(texts)):
            for j in range(i + 1, len(texts)):
                a, b = texts[i], texts[j]
                if a["group"] == b["group"]:
                    continue
                if a["group"] in ("hdr-title", "hdr-head", "footer") and b["group"] in ("hdr-title", "hdr-head", "footer"):
                    continue
                if rects_overlap(a, b, tol=0.04):
                    add(ERR, no, "テキスト同士が重なっている",
                        f'"{a["text"][:14]}" × "{b["text"][:14]}"')

        # --- 6. 副色の使用面積 ---------------------------------------------
        ratio_cap = rules.get("secondaryMaxAreaRatio")
        if ratio_cap:
            sec = sum(i.get("area", 0) for i in items if i.get("secondary"))
            body_area = (grid["slideW"] - grid["margin"] * 2) * (grid["bodyBottom"] - grid["bodyTop"])
            if body_area and sec / body_area > ratio_cap:
                add(WARN, no, "副色の面積が上限を超えている",
                    f"{sec/body_area:.0%} > {ratio_cap:.0%}。強調が意味を失う")

    # --- 7. 通し番号 --------------------------------------------------------
    if seen_pages != list(range(1, len(seen_pages) + 1)):
        issues.append((ERR, 0, "ページ番号が連番でない", str(seen_pages)))

    # --- 出力 ---------------------------------------------------------------
    errs = [i for i in issues if i[0] == ERR]
    warns = [i for i in issues if i[0] == WARN]
    print(f"\n{path}  スライド {len(m['slides'])} 枚  テーマ={m.get('theme')}")
    if not issues:
        print("  ok   静的レイアウト検査は通過。次はレンダリングして目視する")
    for lv, no, msg, detail in issues:
        tag = "FAIL" if lv == ERR else "warn"
        where = f"p{no}" if no else "deck"
        print(f"  {tag:4} [{where}] {msg}" + (f"  — {detail}" if detail else ""))
    print(f"\n  → ERROR {len(errs)} 件 / WARN {len(warns)} 件")
    if errs:
        print("  ERROR は生成スクリプトを直して作り直す。出力ファイルを手で直さない。")
    return 1 if errs else 0


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    sys.exit(min(sum(check(a) for a in sys.argv[1:]), 1))
