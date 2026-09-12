# レイアウト規約と deck.lib.js の API

F4 に入る直前に読む。

## 1. グリッド

キャンバスは 13.333 × 7.5 インチ（`LAYOUT_WIDE`）。**必ず `pres.layout` を設定する。**
既定は 10 × 5.625 で、はみ出した図形は黙って消える。

| 名前 | 値 | 意味 |
|---|---|---|
| `margin` | 0.55 | 左右余白。ここを侵すと検査が ERROR を出す |
| `titleY` | 0.26 | タイトル |
| `headY` / `headH` | 0.56 / 0.72 | ヘッドメッセージ（最大 2 行） |
| `headRuleY` | 1.34 | 構造の区切り線（実線） |
| `bodyTop` | 1.55 | ボディ上端 |
| `bodyBottom` | 6.70 | ボディ下端 |
| `footRuleY` | 6.88 | フッタ区切り（点線） |
| `footY` | 6.94 | 出典・ページ番号 |

ボディの実効領域は **12.23 × 5.15 インチ**。ここに収める。

## 2. 文字数の上限

行送りが実測できないぶん、文字数側で余裕を作る。

| 用途 | サイズ | 1 行あたり全角上限の目安 |
|---|---|---|
| ヘッドメッセージ | 18pt | 44 字／行、2 行まで（＝88 字） |
| カード見出し | 13pt | 枠幅 ÷ 0.18 インチ |
| 本文 | 10.5pt | 枠幅 ÷ 0.146 インチ |
| 注記 | 8.5pt | 枠幅 ÷ 0.118 インチ |

**超えたらフォントを縮めない。**枠を広げる → 行数を増やす → 内容を削る、の順で対処する。

## 3. 間隔

- 要素間は 0.3 または 0.5 インチ。混ぜない
- カード間 `gap` の既定は 0.32
- 図の下に注記を置くときは 0.4 以上空ける

## 4. deck.lib.js の API

### Deck

```js
const deck = new Deck({ theme, asOf, overrides });
deck.cover({ eyebrow, title, subtitle, kpis:[{value,label}], asOfNote, legend });
const s = deck.slide({ title, head, source });   // 4 層構造を自動で置く
await deck.save(outPath);                        // pptx と *.manifest.json を書く
deck.G  // grid   deck.T // type   deck.P // palette
```

`slide()` はページ番号を自動採番し、タイトル・ヘッドメッセージ・区切り線 2 本・
出典・ページ番号を置く。**これらを個別に書かない。**

### Slide のプリミティブ

色は必ず**役割名**で渡す（`"primary"` `"secondary"` `"muted"` `"pale"` `"rule"`
`"body"` `"textMuted"` `"inverse"` `"secondaryPale"` `"paper"` `"ruleFaint"`）。
生の hex を渡すと例外が飛ぶ。

```js
s.text(str, {x,y,w,h, size, bold, color, align, valign, mono, lineSpacing, group, noWrapCheck})
s.label(str, x, y, w)                 // 小さいグレーの見出し
s.box({x,y,w,h, fill, stroke, strokeW, dash, group})
s.line({x,y,w,h, color, width, dash})
s.circle({x,y,r, fill, stroke, strokeW})
s.arrow({x,y,w,h, color, dir})        // dir:"right"(既定) | "down"
s.callout(str, {x,y,w,h, warn})       // warn:true で破線＝注意
s.note(str, {x,y,w})                  // ボディ下端の脚注
```

`size` は `theme.type.sizes` のキー名（`"head" "cardTitle" "body" "small" "note" "kpi"`）
または pt 数値。`group` は重なり検査の単位で、同一グループ内の重なりは意図的とみなす。
`noWrapCheck: true` は 1 行前提の短い注記に付ける（軸ラベル等）。

### 複合コンポーネント

```js
s.bars({x,y,w,h, data:[{label,value,accent?,plan?,display?}], max?, decimals?, ticks?, barW?, monoLabels?})
s.hbars({x,y,w, data:[{label,value,accent?,ghost?}], labelW?, rowH?, valueW?})
s.stairs({x,y,w,h, steps:[{label,caption,note,ratio,accent?,plan?}]})
s.cards({x,y,w,h, cards:[{title,sub,accent?,rows:[[k,v],...]}], gap?, headH?})
s.table({x,y,w, cols:[{label,w,align?,mono?}], rows:[{cells:[...], __accent?}], rowH?, zebra?})
s.kpis({x,y,w,h, kpis:[{value,label,accent?}], gap?, framed?})
s.timeline({x,y,w, events:[{date,title,note,future?,side?}], solidRatio?, cardH?})
```

意味づけの約束：

- `accent` → 副色。**主題にだけ付ける**
- `plan` / `future` → 点線・白抜き。未実施・予定
- `ghost` → 破線＋淡色。到達できない・失われる量

### ネイティブのグラフ機能を使わない理由

「特定の棒だけ副色にする」という意味づけを確実に通すため、および注釈を棒の
正確な位置に重ねるため。既定のグラフは見た目も環境依存で、資料のトーンから浮く。
**`addChart()` は使わない。**

## 5. 高さの見積もり

可変長のテキストを置く前に行数を見積もる。`deck.lib.js` の `estLines()` が使える。

```js
const { estLines } = require(".../deck.lib.js");
const lines = estLines(text, 10.5, boxW, deck.T);
const h = lines * (10.5 / 72) * deck.T.lineFactor + 0.1;
```

`cards()` と `table()` は内部でこれを行い、行の高さを内容に合わせて伸ばす。

## 6. 実装の順序

1. 全スライドの骨格（`slide()` の呼び出しとヘッドメッセージ）を先に並べる
2. ボディを 1 枚ずつ埋める
3. `deck.save()` → 形式検証 → レイアウト検査
4. ERROR が出たら**生成スクリプトを直す。**出力ファイルを手で直さない

`evals/smoke.js` が全コンポーネントを 1 回ずつ使った実例になっている。
迷ったらこれを読むのが早い。

## 7. この段階で起きやすい例外

`exceptions.md` の C 章、特に C3（ヘッドメッセージが長い）、C4（桁が開く）、
C5（系列が多い）、C9（ライブラリが壊れる書き方）。
