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

ボディの実効領域は **12.23 × 5.15 インチ**。ここに収め、**ここを使い切る。**

## 2. ボディの型（座標は `regions()` が出す）

**座標を手で決めない。**`s.regions(preset, opts)` がボディを下端まで使う矩形を返す。
どの型でも、図には解釈が隣にある。

| 型 | `regions()` | 使いどころ | 中身 |
|---|---|---|---|
| **図＋ペイン（既定）** | `"chart-pane"` 58:42 | 時系列・構成比・階段 | 左に図、右に `pane()` 2〜4 点 |
| ペイン＋図 | `"pane-chart"` 42:58 | 結論を先に読ませたいとき | 左に `pane()`、右に図 |
| 2 列 | `"two"` 50:50 | 図＋表、比較 | 左右に別の部品 |
| 3 列 | `"three"` | サマリー・比較 | `cards()` 3 枚、または KPI + ペイン |
| 上下 | `"top-bottom"` 45:55 | 階段図・タイムライン・フロー | 上に図、下に `pane()` か `callout()` |
| 全面 | `"full"` | 表・カード列 | 1 部品で埋める |

```js
const r = s.regions("chart-pane", { note: true });     // note:true で脚注 1 行ぶんを空ける
s.bars({ ...s.labeled(r.chart, "売上高（億円）"), data });   // labeled() が見出しを置き、内側矩形を返す
s.pane({ ...r.pane, title: "読み取り", items: [...] });
s.note("…");
```

opts：`note`（脚注を空ける）、`split`（主領域の比率）、`gap`（既定 0.5）、`y` / `bottom`（入れ子にするとき）。
入れ子：`s.regions("two", { y: r.bottom.y, bottom: r.bottom.bottom })` で上下型の下段をさらに 2 列に切る。

**ペインの中身の規約：**

- 2〜4 点。各点は `lead`（数値を含む 1 行の要点、太字）＋ `body`（1〜2 文の説明）
- 1 点目がヘッドメッセージの根拠になる。**ヘッドメッセージはペインの 1 点目から出す**
- 図の主題に副色を当てたら、ペインの要点には当てない（副色 1 枚 1 箇所）
- `numbered: true` で 01 02 … を振る。順序に意味があるときだけ

## 3. 文字数の上限

行送りが実測できないぶん、文字数側で余裕を作る。

| 用途 | サイズ | 1 行あたり全角上限の目安 |
|---|---|---|
| ヘッドメッセージ | 18pt | 44 字／行、2 行まで（＝88 字） |
| カード見出し | 13pt | 枠幅 ÷ 0.18 インチ |
| 本文・ペイン | 10.5pt | 枠幅 ÷ 0.146 インチ |
| 注記 | 8.5pt | 枠幅 ÷ 0.118 インチ |

**超えたらフォントを縮めない。**枠を広げる → 行数を増やす → 内容を削る、の順で対処する。

## 4. 間隔

- 要素間は 0.3 または 0.5 インチ。混ぜない
- カード間 `gap` の既定は 0.32
- 図の下に注記を置くときは `regions({ note: true })` で 0.45 空ける

## 5. deck.lib.js の API

### Deck

```js
const deck = new Deck({ theme, asOf, brand, overrides });
deck.cover({ eyebrow, title, subtitle, kpis:[{value,label}], asOfNote, legend });
const s = deck.slide({ title, head, source });   // 4 層構造を自動で置く
await deck.save(outPath);                        // pptx と *.manifest.json を書く
deck.G  // grid   deck.T // type   deck.P // palette
```

`brand: { secondary: "0055A4", primary?: "…", source?: "…" }` はブランド色の写像。
`slide()` はページ番号を自動採番し、タイトル・ヘッドメッセージ・区切り線 2 本・
出典・ページ番号を置く。**これらを個別に書かない。**

### 領域

```js
s.regions(preset, {note, split, gap, y, bottom})   // → {chart, pane} / {left, right} / {a,b,c} / {top, bottom} / {main}
s.labeled(rect, "見出し")                          // ラベルを置き、0.38 下がった内側矩形を返す
```

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
s.callout(str, {x,y,w,h, accent?, warn?})   // 既定＝主色の実線枠。accent＝副色。warn＝破線
s.note(str, {x,y,w})                  // ボディ下端の脚注
```

`size` は `theme.type.sizes` のキー名（`"head" "cardTitle" "body" "small" "note" "kpi"`）
または pt 数値。`group` は重なり検査の単位で、同一グループ内の重なりは意図的とみなす。
`noWrapCheck: true` は 1 行前提の短い注記に付ける（軸ラベル等）。

### 複合コンポーネント

```js
s.pane({x,y,w,h?, title?, numbered?, items:[{lead, body?, accent?}]})       // 解釈ペイン
s.bars({x,y,w,h, data:[{label,value,accent?,plan?,display?}], max?, decimals?, ticks?, barW?, monoLabels?})
s.hbars({x,y,w,h?, data:[{label,value,accent?,ghost?}], labelW?, rowH?, valueW?})
s.stairs({x,y,w,h, steps:[{label,caption,note,ratio,accent?,plan?}]})
s.cards({x,y,w,h?, cards:[{title,sub,accent?,rows:[[k,v],...]}], gap?, headH?})
s.table({x,y,w,h?, cols:[{label,w,align?,mono?}], rows:[{cells:[...], __accent?}], rowH?, zebra?})
s.kpis({x,y,w,h?, kpis:[{value,label,accent?}], gap?, framed?})
s.timeline({x,y,w, events:[{date,title,note,future?,accent?,side?}], solidRatio?, cardH?})
```

**`h` の意味は「軸ラベル・値ラベルを含む総高さ」。**`regions()` の矩形をそのまま
スプレッドで渡せる。`h` を省略できる部品（`pane` `cards` `kpis` `hbars` `table`）は
省略するとボディ下端まで、または内容に合わせて伸びる。

意味づけの約束：

- `accent` → 副色。**主題にだけ、1 枚に 1 つ**
- `plan` / `future` → 点線・白抜き。未実施・予定。**色は変わらない**
- `ghost` → 破線＋淡色。到達できない・失われる量

内容が枠を超えると（`pane` `cards` `table`）台帳に `overflow` が記録され、
`check_layout.py` が ERROR にする。フォントを縮めず、内容を削るか領域を広げる。

### ネイティブのグラフ機能を使わない理由

「特定の棒だけ副色にする」という意味づけを確実に通すため、および注釈を棒の
正確な位置に重ねるため。既定のグラフは見た目も環境依存で、資料のトーンから浮く。
**`addChart()` は使わない。**

## 6. 高さの見積もり

可変長のテキストを置く前に行数を見積もる。`deck.lib.js` の `textHeight()` が使える。

```js
const { textHeight } = require(".../deck.lib.js");
const h = textHeight(text, 10.5, boxW, deck.T);
```

`pane()` `cards()` `table()` は内部でこれを行い、行の高さを内容に合わせて伸ばす。

## 7. 実装の順序

1. 全スライドの骨格（`slide()` の呼び出しとヘッドメッセージ）を先に並べる
2. 各枚の `regions()` の型を決める（図＋ペインが既定）
3. ボディを 1 枚ずつ埋める。図 → ペイン → 脚注の順
4. `deck.save()` → 形式検証 → レイアウト検査
5. ERROR が出たら**生成スクリプトを直す。**出力ファイルを手で直さない

`evals/smoke.js` が全コンポーネントと全ての型を 1 回ずつ使った実例になっている。
迷ったらこれを読むのが早い。

## 8. この段階で起きやすい例外

`exceptions.md` の C 章、特に C3（ヘッドメッセージが長い）、C4（桁が開く）、
C5（系列が多い）、C9（ライブラリが壊れる書き方）、C10（副色が 2 箇所以上）、
C11（ボディが埋まらない）。
