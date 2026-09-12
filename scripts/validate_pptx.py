#!/usr/bin/env python3
"""slide-studio / pptx の形式検証。

    python3 scripts/validate_pptx.py out.pptx

PowerPoint が開けないファイルは、他のツールでは開けてしまうことがある
（python-pptx は通し、LibreOffice も描画する）。そのため「開けたから正しい」とは
判断できない。ここでは PowerPoint が拒否する既知の破損パターンを直接見る。

外部スキルに依存しないよう自前で持っている。標準ライブラリのみで動く。
"""
import re
import sys
import zipfile
import xml.etree.ElementTree as ET

REQUIRED = [
    "[Content_Types].xml",
    "_rels/.rels",
    "ppt/presentation.xml",
    "ppt/_rels/presentation.xml.rels",
]
NS_R = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
NS_P = "{http://schemas.openxmlformats.org/presentationml/2006/main}"


def check(path):
    fails = []

    def t(cond, msg, detail=""):
        print(("  ok   " if cond else "  FAIL ") + msg + (f"  {detail}" if detail and not cond else ""))
        if not cond:
            fails.append(msg)

    print(f"\n{path}")
    try:
        z = zipfile.ZipFile(path)
    except Exception as e:
        print(f"  FAIL zip として開けない  {e}")
        return 1

    names = set(z.namelist())
    bad = z.testzip()
    t(bad is None, "アーカイブが壊れていない", str(bad))
    t(all(r in names for r in REQUIRED), "必須パートが揃っている",
      str([r for r in REQUIRED if r not in names]))

    # --- 全 XML パートの整形式性 -------------------------------------------
    broken = []
    for n in sorted(names):
        if not n.endswith((".xml", ".rels")):
            continue
        try:
            ET.fromstring(z.read(n))
        except Exception as e:
            broken.append(f"{n}: {e}")
    t(not broken, "全 XML パートが整形式", "; ".join(broken[:3]))

    # --- 関係参照の解決 -----------------------------------------------------
    missing = []
    for n in [x for x in names if x.endswith(".rels")]:
        base = n.rsplit("_rels/", 1)[0]
        try:
            root = ET.fromstring(z.read(n))
        except Exception:
            continue
        for rel in root:
            tgt = rel.get("Target", "")
            mode = rel.get("TargetMode", "")
            if mode == "External" or tgt.startswith(("http", "../slideMaster")) is False and mode == "External":
                continue
            if mode == "External" or tgt.startswith("http"):
                continue
            resolved = norm(base + tgt)
            if resolved not in names:
                missing.append(f"{n} -> {tgt}")
    t(not missing, "関係（rels）の参照先がすべて存在する", "; ".join(missing[:3]))

    # --- スライド数の整合 ---------------------------------------------------
    slides = sorted(x for x in names if re.fullmatch(r"ppt/slides/slide\d+\.xml", x))
    try:
        pres = ET.fromstring(z.read("ppt/presentation.xml"))
        lst = pres.find(NS_P + "sldIdLst")
        declared = len(list(lst)) if lst is not None else 0
    except Exception:
        declared = -1
    t(declared == len(slides), "presentation.xml のスライド数と実体が一致",
      f"宣言={declared} 実体={len(slides)}")

    # --- 色指定の破損（PowerPoint が最も嫌うもの） --------------------------
    badcolor = []
    for n in slides + [x for x in names if x.startswith("ppt/slideLayouts/") or x.startswith("ppt/slideMasters/")]:
        xml = z.read(n).decode("utf-8", "replace")
        for v in re.findall(r'srgbClr val="([^"]*)"', xml):
            if not re.fullmatch(r"[0-9A-Fa-f]{6}", v):
                badcolor.append(f"{n}: {v}")
    t(not badcolor, "色指定が 6 桁 hex のみ（# や 8 桁が無い）", "; ".join(badcolor[:3]))

    # --- presentation.xml の子要素順序 --------------------------------------
    # pptxgenjs は sldIdLst の直後に notesMasterIdLst を書く。順序を入れ替えると
    # 他ツールは通すが PowerPoint が開けなくなる。
    try:
        order = [c.tag.replace(NS_P, "") for c in ET.fromstring(z.read("ppt/presentation.xml"))]
        ok_order = True
        if "sldIdLst" in order and "sldMasterIdLst" in order:
            ok_order = order.index("sldMasterIdLst") < order.index("sldIdLst")
        t(ok_order, "presentation.xml の子要素順序が正しい", str(order))
    except Exception as e:
        t(False, "presentation.xml の子要素順序が正しい", str(e))

    # --- 空スライドの検出 ---------------------------------------------------
    empty = []
    for n in slides:
        xml = z.read(n).decode("utf-8", "replace")
        if "<p:sp>" not in xml and "<p:pic>" not in xml and "<p:graphicFrame>" not in xml:
            empty.append(n)
    t(not empty, "空のスライドが無い", str(empty[:3]))

    if fails:
        print(f"\n  → {len(fails)} 件。生成スクリプトを直して作り直す（ファイルを手で直さない）")
    else:
        print("\n  → 形式検証は通過")
    return len(fails)


def norm(p):
    parts = []
    for seg in p.split("/"):
        if seg == "..":
            if parts:
                parts.pop()
        elif seg not in ("", "."):
            parts.append(seg)
    return "/".join(parts)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    sys.exit(1 if sum(check(a) for a in sys.argv[1:]) else 0)
