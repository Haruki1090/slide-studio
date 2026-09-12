#!/usr/bin/env bash
# slide-studio / 実行環境の能力判定。F0 のゲートで走らせる。
#
#   bash scripts/doctor.sh
#
# 目的は「何ができないか」を着手前に知ること。できないまま進んで
# 最後に出せませんでしたと言うのが最悪なので、ここで先に申告材料を作る。

echo "=== slide-studio doctor ==="
echo "os        : $(uname -s) $(uname -m)"

have() { command -v "$1" >/dev/null 2>&1 && echo yes || echo no; }

NODE=$(have node); echo "node      : $NODE $( [ "$NODE" = yes ] && node -v )"
PY=$(have python3); echo "python3   : $PY"

PG=no
if [ "$NODE" = yes ]; then
  node -e "require('pptxgenjs')" >/dev/null 2>&1 && PG=yes
fi
echo "pptxgenjs : $PG"

SOF=no
for c in soffice libreoffice /Applications/LibreOffice.app/Contents/MacOS/soffice; do
  command -v "$c" >/dev/null 2>&1 && SOF=yes && break
  [ -x "$c" ] && SOF=yes && break
done
echo "libreoffice: $SOF"
echo "pdftoppm  : $(have pdftoppm)"

PPT=no
command -v powershell.exe >/dev/null 2>&1 && PPT="maybe(win)"
command -v osascript >/dev/null 2>&1 && PPT="maybe(mac)"
echo "powerpoint: $PPT"

echo -n "meiryo    : "
if fc-list 2>/dev/null | grep -qi meiryo; then echo yes; else echo "no (代替描画になる)"; fi
echo -n "biz-ud    : "
if fc-list 2>/dev/null | grep -qi "BIZ UD"; then echo yes; else echo "no"; fi
echo -n "jp-font   : "
fc-list :lang=ja family 2>/dev/null | head -1 | cut -d, -f1 || echo "unknown"

# --- 階層の判定 ------------------------------------------------------------
TIER=T0
[ "$SOF" = yes ] && [ "$(have pdftoppm)" = yes ] && TIER=T1
echo
echo "tier      : $TIER  (T2 はサブエージェントの有無で呼び出し側が判定する)"

if [ "$PG" != yes ]; then
  echo
  echo "!! pptxgenjs が無い。生成そのものができない。"
  echo "   打開策: npm install pptxgenjs  （不可なら別形式を提案する）"
fi
if [ "$TIER" = T0 ]; then
  echo
  echo "!! PDF を出せない。着手前にその旨を申告すること。"
  echo "   打開策: winget install TheDocumentFoundation.LibreOffice"
  echo "           brew install --cask libreoffice"
  echo "           apt-get install -y libreoffice poppler-utils"
fi
