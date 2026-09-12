#!/usr/bin/env bash
# slide-studio / pptx → pdf → 画像
#
#   bash scripts/render.sh out.pptx [outdir]
#
# PDF 変換は 4 段の梯子を上から順に試す。段が下がるほど忠実度が落ちるので、
# 使った段を必ず標準出力に出す。納品時にこれを申告する。
#
#   1. ローカルの PowerPoint（Win: COM / Mac: AppleScript）  … 完全一致
#   2. ローカルの LibreOffice（Meiryo 実体あり）             … ほぼ一致
#   3. コンテナの LibreOffice（代替フォント）                 … 書体は別物
#   4. 変換せず pptx のみ                                     … 申告が必須
#
# 素の soffice はサンドボックスでハングするため、専用プロファイルと
# タイムアウトを必ず付ける。これが無いと工程全体が止まる。

set -uo pipefail
PPTX="${1:?usage: render.sh out.pptx [outdir]}"
OUTDIR="${2:-$(dirname "$PPTX")}"
BASE="$(basename "${PPTX%.pptx}")"
PDF="$OUTDIR/$BASE.pdf"
TIER=""

mkdir -p "$OUTDIR"

try_powerpoint_win() {
  command -v powershell.exe >/dev/null 2>&1 || return 1
  powershell.exe -NoProfile -Command "
    try {
      \$p = New-Object -ComObject PowerPoint.Application
      \$d = \$p.Presentations.Open('$(wslpath -w "$PPTX" 2>/dev/null || echo "$PPTX")', \$true, \$false, \$false)
      \$d.SaveAs('$(wslpath -w "$PDF" 2>/dev/null || echo "$PDF")', 32)
      \$d.Close(); \$p.Quit()
    } catch { exit 1 }" >/dev/null 2>&1 || return 1
  [ -f "$PDF" ] && TIER="1: ローカル PowerPoint（完全一致）"
}

try_powerpoint_mac() {
  command -v osascript >/dev/null 2>&1 || return 1
  osascript -e "tell application \"Microsoft PowerPoint\"
      open POSIX file \"$(cd "$(dirname "$PPTX")" && pwd)/$(basename "$PPTX")\"
      save active presentation in POSIX file \"$PDF\" as save as PDF
      close active presentation saving no
    end tell" >/dev/null 2>&1 || return 1
  [ -f "$PDF" ] && TIER="1: ローカル PowerPoint（完全一致）"
}

try_soffice() {
  local SOF=""
  for c in soffice libreoffice /Applications/LibreOffice.app/Contents/MacOS/soffice; do
    command -v "$c" >/dev/null 2>&1 && SOF="$c" && break
    [ -x "$c" ] && SOF="$c" && break
  done
  [ -z "$SOF" ] && return 1

  local PROF="/tmp/slide-studio-lo-$$"
  rm -rf "$PROF"
  timeout 180 "$SOF" \
    -env:UserInstallation="file://$PROF" \
    --headless --norestore --invisible --nolockcheck --nodefault \
    --convert-to pdf --outdir "$OUTDIR" "$PPTX" >/dev/null 2>&1
  rm -rf "$PROF"
  [ -f "$PDF" ] || return 1

  # Meiryo 実体があるかで 2 段目か 3 段目かが決まる
  if fc-list 2>/dev/null | grep -qi "meiryo"; then
    TIER="2: ローカル LibreOffice（指定フォントあり・ほぼ一致）"
  else
    TIER="3: LibreOffice ＋ 代替フォント（レイアウトは正・書体は別物）"
  fi
}

case "$(uname -s)" in
  Darwin) try_powerpoint_mac || try_soffice ;;
  *)      try_powerpoint_win || try_soffice ;;
esac

if [ -z "$TIER" ]; then
  echo "PDF_TIER=4: 変換できず。pptx のみ納品し、その旨を申告すること"
  echo "  打開策: winget install TheDocumentFoundation.LibreOffice"
  echo "          brew install --cask libreoffice"
  exit 2
fi

echo "PDF_TIER=$TIER"
echo "PDF=$PDF"

# --- 画像化（目視 QA 用） --------------------------------------------------
if command -v pdftoppm >/dev/null 2>&1; then
  rm -f "$OUTDIR"/slide-*.jpg
  pdftoppm -jpeg -r "${DPI:-110}" "$PDF" "$OUTDIR/slide"
  echo "IMAGES=$(ls -1 "$OUTDIR"/slide-*.jpg 2>/dev/null | wc -l | tr -d ' ')"
  ls -1 "$OUTDIR"/slide-*.jpg 2>/dev/null
else
  echo "IMAGES=0  (pdftoppm が無いため画像化できない。目視 QA は PDF を直接見る)"
fi
