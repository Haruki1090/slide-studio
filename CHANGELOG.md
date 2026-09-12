# Changelog

このプロジェクトの変更履歴。形式は [Keep a Changelog](https://keepachangelog.com/ja/1.1.0/) に、
バージョンは [Semantic Versioning](https://semver.org/lang/ja/) に従う。

## [Unreleased]

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

[Unreleased]: https://github.com/Haruki1090/slide-studio/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Haruki1090/slide-studio/releases/tag/v0.1.0
