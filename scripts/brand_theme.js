#!/usr/bin/env node
/* slide-studio / ブランド色をテーマに写像し、解決済みテーマ JSON を出力する。
 *
 *   node scripts/brand_theme.js <theme> <secondaryHex> [primaryHex] > /tmp/brand.json
 *   python3 scripts/check_contrast.py /tmp/brand.json
 *
 * 通ったら new Deck({ theme: "<theme>", brand: { secondary: "<hex>" } }) で使う。
 * hex は # なしの 6 桁。基準を割った色は面に使わず線と文字に限定する（design-system.md）。
 */
const path = require("path");
const { loadTheme } = require(path.join(__dirname, "..", "assets", "deck.lib.js"));

const [theme, secondary, primary] = process.argv.slice(2);
if (!theme || !secondary) {
  console.error("usage: brand_theme.js <theme> <secondaryHex> [primaryHex]");
  process.exit(2);
}
const t = loadTheme(theme, null, { secondary, primary });
t.name = `${theme}+brand`;
t.label = `${t.label}／ブランド色 secondary=${t.palette.secondary}`;
process.stdout.write(JSON.stringify(t, null, 2) + "\n");
