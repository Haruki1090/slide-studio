# Contributing

Issue も Pull Request も歓迎します。日本語・英語どちらでも構いません。

## 開発環境

```bash
git clone https://github.com/Haruki1090/slide-studio.git
cd slide-studio
npm install
bash scripts/doctor.sh   # 環境の能力を確認
npm test                 # コントラスト検査 + 4 テーマのスモーク生成・形式検証・レイアウト検査
```

PDF まで確認したい場合は LibreOffice と poppler（`pdftoppm`）を入れて `npm run render` を実行します。

## 変更の種類ごとの確認事項

| 変更するもの | 確認すること |
|---|---|
| `assets/deck.lib.js` | `npm test` が通る。新しいプリミティブを足したら `evals/smoke.js` にも 1 回描かせる。manifest に記録される（`check_layout.py` が検査できる） |
| `assets/themes/*.json` | `python3 scripts/check_contrast.py <theme.json>` が通る。生の `#` 付き hex を書かない |
| `scripts/*.py` | 標準ライブラリのみで動くこと（外部依存を足さない） |
| `scripts/*.sh` | `shellcheck -S warning` が通る |
| `SKILL.md` / `references/` | 手順を足すときは「なぜそうするか」を 1 行添える。原則（SKILL.md §1）と衝突しない |

## 設計上の約束

- **スキルは自己完結させる。** 他のスキルやプラグインを参照・呼び出ししない
- **色は役割名で指定する。** スライド側に生の hex を書かせない
- **品質規則は環境の階層（T0 / T1 / T2）で変えない。** 変わるのは検証の厳しさと速度だけ
- 検査スクリプトの ERROR は出力ファイルではなく生成スクリプト側を直して解消する

## コミット

Conventional Commits 風の短い prefix（`feat:` `fix:` `docs:` `refactor:` `test:` `chore:`）を推奨します。
必須ではありません。
