# slide-studio

[![CI](https://github.com/Haruki1090/slide-studio/actions/workflows/ci.yml/badge.svg)](https://github.com/Haruki1090/slide-studio/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

テーマを渡すと、**調査から pptx / pdf の出力までを一続きで行う** [Claude Code](https://docs.anthropic.com/ja/docs/claude-code) 用スキル。

「〇〇についてスライドにして」「〇〇社を整理した提案資料を作って」のように、
**自分で材料を集める必要がある資料作成**を、品質ゲート付きの工程として進めます。

> [English summary at the bottom.](#english)

---

## 何が違うのか

自動生成スライドの典型的な失敗を、原則・工程・機械検査の 3 層で潰しています。

| 原則 | よくある失敗 |
|---|---|
| **ヘッドメッセージは結論である**（述語を持つ文で書く） | 「業績推移」のような体言止めの見出し |
| **1 枚 1 メッセージ** | 1 枚に論点を 3 つ詰める |
| **色は意味に固定する**（役割は 3 つだけ） | 強調のたびに色が増える |
| **欠測を隠さない** | 欠けた年を線で結んで滑らかに見せる |
| **事実と推定を分ける** | 因果を断定して書く |
| **出典は各ページに置く** | 巻末に一括、または無い |
| **出力を読み直す**（レイアウト検査と内容の検算は別工程） | コードが通ったら完成とする |

- **止まるのは 1 回だけ。** 骨子（ガバニングソート 1 文＋各枚のヘッドメッセージ案）を提示して承認を取り、あとは納品まで走ります
- **材料が足りなければ枚数を減らします。** 一般論や「〇〇とは」で埋めません。作れなかった項目は納品時に申告します
- **体言止めの見出し・はみ出し・重なりは描画前に機械で落とします。** 目視は機械に見えないものだけに集中します
- **数値主張とグラフの一致は、生成した本人とは別の目で検算します。** サブエージェントが使える環境では独立したレビュアーに画像だけを渡します

## 工程

```
F0 受注解釈   → G0 制約表が埋まっているか／環境の能力を把握したか
F1 調査       → G1 骨子を立てるだけの材料が揃ったか
F2 物語設計   → G2 ガバニングソート 1 文が立ち、各枚が従属するか   ★ ここで 1 回だけ承認
F3 ボディ設計 → G3 全枚のヘッドメッセージが結論文か／1 枚 1 メッセージか
F4 実装       → G4 形式検証・静的レイアウト検査が通るか
F5 検証       → G5 レイアウト目視 ＋ 数値主張の検算が通るか
F6 納品       → G6 出典・欠測・推定・検証水準の申告が漏れていないか
```

ゲートを落ちたら決まった場所へ戻ります（配置の不具合 → F4、事実誤認 → F2/F3、材料不足 → F1）。
想定外への対処は `references/exceptions.md` に「検知シグナル／既定の対応／禁じ手」の形でカタログ化してあります。

## インストール

### 1. スキルとして配置する

```bash
# 個人スキルとして（すべてのプロジェクトで有効）
git clone https://github.com/Haruki1090/slide-studio.git ~/.claude/skills/slide-studio

# またはプロジェクト単位で
git clone https://github.com/Haruki1090/slide-studio.git .claude/skills/slide-studio
```

### 2. 依存を入れる

```bash
cd ~/.claude/skills/slide-studio
npm install            # pptxgenjs
bash scripts/doctor.sh # 何ができる環境かを判定する
```

`doctor.sh` は環境を 3 階層で判定します。**品質規則は階層で変わりません。** 変わるのは検証の到達点だけです。

| 階層 | 必要なもの | 到達点 |
|---|---|---|
| T0 | Node.js ≥ 18、Python 3、pptxgenjs | pptx 生成＋機械検査（PDF は出せない） |
| T1 | ＋ LibreOffice、poppler（`pdftoppm`） | ＋ PDF 出力、画像化、自己目視 |
| T2 | ＋ サブエージェント、ローカルの PowerPoint / フォント | ＋ 初見レビュー、PDF が完全一致 |

```bash
brew install --cask libreoffice && brew install poppler          # macOS
sudo apt-get install -y libreoffice poppler-utils                 # Debian / Ubuntu
winget install TheDocumentFoundation.LibreOffice                  # Windows
```

## 使い方

Claude Code で、調査を伴う資料作成を頼むだけです。

```
〇〇株式会社の事業構造を、投資家向けに 12 枚程度のスライドにまとめて。pptx と PDF で。
```

```
サウナ業界の市場構造を 10 枚にまとめて。紺基調でお願いします。
```

骨子の提示（G2）で一度止まります。既定値は 1 行で示されるので、そのまま進めるなら何も言わなくて構いません。

```
テーマ：白地＋墨＋朱／出力：pptx + pdf／Appendix：本編に収める（20 枚超なら分離）
　— このまま進めます。変更があれば指示してください。
```

納品時には pptx / pdf に加えて、**構成のサマリ・作れなかった項目・推定と欠測として扱った箇所・どの水準まで検証したか**が必ず添えられます。

### テーマ

`assets/themes/` に 4 種。`overrides` で部分上書きもできます（レイアウトコードは触りません）。

| テーマ | 印象 |
|---|---|
| `default` | 白地＋墨＋朱 |
| `mono` | 完全モノクロ |
| `navy` | 紺基調 |
| `editorial` | 黒地・大見出し |

独自の色を渡した場合は役割へ写像したうえで `check_contrast.py` にかけ、基準を割る色は面には使わず線と文字に限定します。色を黙って差し替えることはしません。

### ライブラリを直接使う

スキル経由でなくても `deck.lib.js` は単体で使えます。色は役割名で指定し、生の hex を書くと例外になります。

```js
const { Deck } = require("./assets/deck.lib.js");
const deck = new Deck({ theme: "default", asOf: "2026-09-12" });
const G = deck.G, M = G.margin;

deck.cover({ eyebrow: "調査資料", title: "…", subtitle: "…", kpis: [] });
const s = deck.slide({ title: "業績推移", head: "直近期の利益は前期比 3 倍に伸びた", source: "有価証券報告書" });
s.label("当期純利益（億円）", M, G.bodyTop, 7.0);
s.bars({ x: M, y: G.bodyTop + 0.38, w: 7.0, h: 3.4, data: [{ label: "FY24", value: 3.1 }, { label: "FY25", value: 9.2, accent: true }] });
await deck.save("out/deck.pptx");   // 同時に out/deck.manifest.json を書く
```

```bash
python3 scripts/validate_pptx.py out/deck.pptx           # 形式検証
python3 scripts/check_layout.py  out/deck.manifest.json  # 描画前の静的レイアウト検査
bash    scripts/render.sh        out/deck.pptx out/      # PDF（4 段梯子）＋ 画像化
```

## リポジトリ構成

```
SKILL.md               スキル本体。原則・工程・ゲート・例外への構え
references/            フェーズごとに読むリファレンス
  research.md            調査の進め方と打ち切り規則
  narrative.md           ガバニングソートと 4 つの構成型
  design-system.md       色の役割・タイポグラフィ・テーマのアレンジ
  charts.md              データ形状 → 表現の対応表
  layout.md              deck.lib.js の API と寸法の指針
  pptxgenjs.md           pptxgenjs の地雷
  qa.md                  検証の手順
  exceptions.md          例外カタログ（検知シグナル／既定の対応／禁じ手）
  environments.md        実行環境の階層と打開策
assets/
  deck.lib.js            デッキ生成ライブラリ（pptxgenjs の上に構築）
  themes/*.json          テーマ定義
scripts/
  doctor.sh              環境の能力判定
  validate_pptx.py       形式検証（標準ライブラリのみ）
  check_layout.py        静的レイアウト検査（標準ライブラリのみ）
  check_contrast.py      コントラスト検査（標準ライブラリのみ）
  render.sh              pptx → pdf → 画像
agents/reviewer.md     初見レビュー用サブエージェントへの指示
evals/                 スモークテストと評価シナリオ
```

## 開発

```bash
npm install
npm test          # コントラスト検査 + 4 テーマのスモーク生成・形式検証・レイアウト検査
npm run render    # LibreOffice があれば PDF と画像まで
```

CI は GitHub Actions で 4 テーマそれぞれのスモークデッキを生成し、形式検証と静的レイアウト検査を通しています。
生成物は Actions の artifact からダウンロードできます。詳しくは [CONTRIBUTING.md](CONTRIBUTING.md)。

## やらないこと

- 社内データや添付ファイルの分析を主とする資料（外部調査との併用は可）
- 30 枚を超える資料（分割を提案します）
- アニメーション・画面遷移
- 写真やロゴの配置。既定では図形とタイポグラフィのみで構成し、出所不明の画像を貼りません
- 取得を拒否しているページへの回り込み

## ライセンス

[MIT](LICENSE) © 2026 Haruki Inoue

---

## English

**slide-studio** is a [Claude Code](https://docs.anthropic.com/en/docs/claude-code) skill that turns a topic into a finished pptx / pdf deck, running research → narrative design → body design → implementation → verification → delivery as a single gated pipeline.

It targets the usual failures of auto-generated slides: headlines that are labels instead of conclusions, several messages per slide, colors that multiply, gaps in data smoothed over, facts and estimates blurred together, sources missing from pages, and output never re-read. It stops exactly once (to approve the outline), shrinks the deck rather than padding it when material is thin, catches overflow / overlap / noun-ending headlines statically before rendering, and has a second, independent pass verify that every numeric claim is actually supported by its chart.

Install by cloning into `~/.claude/skills/slide-studio`, then `npm install` and `bash scripts/doctor.sh`. Requires Node.js ≥ 18 and Python 3; LibreOffice + poppler unlock PDF output. The bundled `assets/deck.lib.js` (a themed layer over pptxgenjs that emits a layout manifest) and the checkers under `scripts/` work standalone. Documentation is currently in Japanese. MIT licensed.
