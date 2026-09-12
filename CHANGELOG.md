# Changelog

このプロジェクトの変更履歴。形式は [Keep a Changelog](https://keepachangelog.com/ja/1.1.0/) に、
バージョンは [Semantic Versioning](https://semver.org/lang/ja/) に従う。

## [Unreleased]

## [0.2.0] - 2026-09-13

実案件（企業調査 13 枚）で「表紙が黒い・企業カラーを使わない・色が多い」「余剰な空白」
「グラフが大きく説明が少ない」と指摘された 3 系統を、規約・部品・検査の 3 層で潰した。

### Added

- `Slide.regions()` / `Slide.labeled()` — ボディを下端まで使う矩形を返す領域プリセット（chart-pane / pane-chart / two / three / top-bottom / full）
- `Slide.pane()` — 図に添える解釈ペイン（数値を含む要点＋説明、2〜4 点）
- `Deck({ brand })` と `scripts/brand_theme.js` — ブランド色を副色に写像し、淡色を自動で導く。`check_contrast.py` は manifest.json も受け付ける
- `check_layout.py` に 4 検査 — 副色の箇所数（1 枚 1 箇所）／ボディの未使用領域／図だけで解釈が無い／部品の内容溢れ（`overflow`）
- `check_contrast.py` に表紙の 3 組（題名・注記・eyebrow）
- SKILL.md の原則を 9 本に（08 図は解釈と対で置く、09 ボディは下端まで使う）。F0 に配色の項目と 1 回のヒアリング、F1 にブランド色の採取、F3 にボディ構成の規約
- `references/narrative.md` に避ける語のリスト、`exceptions.md` に C10〜C12・E7・E8
- `evals/evals.json` にシナリオ 04（ブランド色とボディ構成）、`npm run smoke:brand`

### Changed

- **表紙を白地に**（default / mono / navy）。黒地は `editorial` を指定したときだけ
- `callout()` の既定を主色の実線枠に。副色は `accent: true` のときだけ。淡色面を敷かない
- `table()` の強調行は文字色のみ副色。淡色面は `accentFill: true` のときだけ
- `bars()` / `stairs()` の `h` を「軸ラベル・値ラベルを含む総高さ」に変更（`regions()` の矩形をそのまま渡せる）
- `plan` / `future`（予定）は点線のみで示し、色を変えない。副色は `accent` にだけ反応する
- `cards()` `kpis()` `hbars()` `table()` `pane()` の `h` を省略可能に（ボディ下端まで、または内容に合わせる）
- 表紙の副題・KPI の位置を題名の行数から導く（2 行の題名で重なっていた）
- `editorial` の見出し領域を 22pt 2 行が入る高さに
- manifest に `palette` `brand` とテキストの `color` `role` を記録
- `evals/smoke.js` を規約の手本として書き直し（全部品＋全レイアウト型、WARN 0 件）

## [0.1.1] - 2026-09-12

### Changed

- `SKILL.md` の description から、公開リポジトリには含まれない別スキル名への言及を外した

## [0.1.0] - 2026-09-12

初回公開。

### Added

- `SKILL.md` — 調査 → 物語設計 → ボディ設計 → 実装 → 検証 → 納品の 7 工程と各ゲート、品質の 7 原則、回帰経路、劣化順序
- `references/` — 調査・物語・デザインシステム・図の選択・レイアウト・pptxgenjs の地雷・QA・例外カタログ・実行環境の各リファレンス
- `assets/deck.lib.js` — pptxgenjs の上に載せたデッキ生成ライブラリ。テーマ適用、役割名による配色、図形プリミティブ（bars / hbars / stairs / cards / table / kpis / timeline / callout など）、レイアウト台帳（manifest）出力
- `assets/themes/` — `default`（白地＋墨＋朱）／`mono`／`navy`／`editorial` の 4 テーマ
- `scripts/doctor.sh` — 実行環境の能力判定（T0 / T1 / T2）
- `scripts/validate_pptx.py` — PowerPoint が拒否する破損パターンの形式検証
- `scripts/check_layout.py` — 描画前の静的レイアウト検査（はみ出し・重なり・体言止め見出しなど）
- `scripts/check_contrast.py` — テーマのコントラスト比検査
- `scripts/render.sh` — pptx → pdf → 画像の 4 段梯子
- `agents/reviewer.md` — 初見レビュー用サブエージェントへの指示（レイアウト検査と内容検算を分離）
- `evals/` — スモークテストと 3 本の評価シナリオ

[Unreleased]: https://github.com/Haruki1090/slide-studio/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/Haruki1090/slide-studio/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/Haruki1090/slide-studio/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/Haruki1090/slide-studio/releases/tag/v0.1.0
