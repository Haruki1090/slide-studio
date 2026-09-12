/* =========================================================================
 * slide-studio / deck.lib.js
 *
 * pptxgenjs の上に、テーマ適用・4 層構造・図形プリミティブ・
 * レイアウト台帳（manifest）の出力を載せたもの。
 *
 * 設計意図：
 *  - 座標計算を毎回書き直さない。ボディ領域は regions() で切り出す
 *  - 色は必ず役割名で指定する。生の hex をスライド側に書かせない
 *  - 副色は 1 枚 1 箇所。部品の既定は主色で、accent を付けた所だけ副色になる
 *  - 描画したものは全て manifest に記録し、レンダリング前に機械検査できる
 *
 * 使い方:
 *   const {Deck} = require('.../deck.lib.js');
 *   const deck = new Deck({theme:'default', asOf:'2026-09-12', brand:{secondary:'0055A4'}});
 *   deck.cover({eyebrow, title, subtitle, kpis});
 *   const s = deck.slide({title:'業績推移', head:'…', source:'…'});
 *   const r = s.regions('chart-pane', {note:true});
 *   s.bars({...s.labeled(r.chart, '売上高（億円）'), data:[...]});
 *   s.pane({...r.pane, title:'読み取り', items:[{lead:'…', body:'…'}]});
 *   await deck.save('/path/out.pptx');   // pptx と out.manifest.json を書く
 * ========================================================================= */

const fs = require("fs");
const path = require("path");
const pptxgen = require("pptxgenjs");

/* ---------- 文字幅の推定 ---------------------------------------------------
 * フォント実体に依存しない。日本語の全角は書体を問わず 1em 幅なので、
 * 文字種で分類すれば十分な精度が出る。これによりレンダラが
 * 代替フォントに置き換えても、検査の精度は落ちない。
 * ------------------------------------------------------------------------ */
function isFullWidth(ch) {
  const c = ch.codePointAt(0);
  return (
    (c >= 0x1100 && c <= 0x115f) ||
    (c >= 0x2e80 && c <= 0xa4cf) ||
    (c >= 0xac00 && c <= 0xd7a3) ||
    (c >= 0xf900 && c <= 0xfaff) ||
    (c >= 0xfe30 && c <= 0xfe6f) ||
    (c >= 0xff00 && c <= 0xff60) ||
    (c >= 0xffe0 && c <= 0xffe6) ||
    (c >= 0x20000 && c <= 0x3fffd)
  );
}

/** 文字列の推定幅（インチ）。fontSize は pt。 */
function textWidthIn(str, fontSize, type) {
  const em = fontSize / 72;
  let w = 0;
  for (const ch of String(str)) {
    if (ch === "\n") continue;
    w += isFullWidth(ch) ? em * type.fullWidthEm : em * type.halfWidthEm;
  }
  return w * type.safety;
}

/** 折り返しを考慮した推定行数。 */
function estLines(str, fontSize, boxW, type) {
  const lines = String(str).split("\n");
  let total = 0;
  for (const ln of lines) {
    const w = textWidthIn(ln, fontSize, type);
    total += Math.max(1, Math.ceil(w / Math.max(boxW, 0.01)));
  }
  return total;
}

/** テキスト枠に必要な高さ（インチ）。 */
function textHeight(str, fontSize, boxW, type, pad = 0.04) {
  return estLines(str, fontSize, boxW, type) * (fontSize / 72) * type.lineFactor + pad;
}

/* ---------- Deck ---------------------------------------------------------- */

class Deck {
  /**
   * @param {object} o
   * @param {string} o.theme     テーマ名（assets/themes/<name>.json）またはテーマ実体
   * @param {string} o.asOf      基準日。フッタと表紙に出す
   * @param {object} o.brand     ブランド色の写像 {secondary, primary?, source?}。6 桁 hex、# なし
   * @param {object} o.overrides テーマの部分上書き（ケースバイケースのアレンジ用）
   */
  constructor(o = {}) {
    this.theme = loadTheme(o.theme || "default", o.overrides, o.brand);
    this.asOf = o.asOf || new Date().toISOString().slice(0, 10);
    this.pres = new pptxgen();
    this.pres.layout = "LAYOUT_WIDE";
    this.page = 1; // 表紙が 1。以降 slide() ごとに採番
    this.manifest = { theme: this.theme.name, brand: this.theme.brand || null, asOf: this.asOf, slides: [] };
    this.slides = [];
  }

  get P() { return this.theme.palette; }
  get T() { return this.theme.type; }
  get G() { return this.theme.grid; }

  /**
   * 表紙。地色はテーマの coverBg（default / mono / navy は白地、editorial のみ黒地）。
   * 副色は eyebrow と短い罫の 1 箇所だけ。
   */
  cover({ eyebrow, title, subtitle, kpis = [], legend, asOfNote }) {
    const { P, T, G } = this;
    const s = this.pres.addSlide();
    s.background = { color: P.coverBg };
    const rec = { no: 1, title: "表紙", head: title, source: null, items: [] };

    const push = (e) => rec.items.push(e);
    const M = G.margin;
    const W = G.slideW - M * 2;

    let y = 1.6;
    if (eyebrow) {
      s.addText(eyebrow, txt({ x: M, y, w: 6, h: 0.32, fontSize: 12, bold: true,
        color: P.secondary, fontFace: T.jp, charSpacing: 1.5 }));
      push({ kind: "text", group: "cover", x: M, y, w: 6, h: 0.32, text: eyebrow, size: 12, color: "secondary" });
    }
    s.addShape(this.pres.ShapeType.line, { x: M, y: y + 0.45, w: 2.2, h: 0, line: { color: P.secondary, width: 2.5 } });
    y += 0.7;

    // 高さは文字サイズから導く。固定値にするとテーマを替えた途端に溢れる
    const tH = Math.max(0.8, textHeight(title, T.sizes.coverTitle, W, T, 0.1));
    s.addText(title, txt({ x: M, y, w: W, h: tH, fontSize: T.sizes.coverTitle, bold: true,
      color: P.coverText, fontFace: T.jp, valign: "top" }));
    push({ kind: "text", group: "cover", x: M, y, w: W, h: tH, text: title, size: T.sizes.coverTitle, color: "coverText" });
    y += tH + 0.12;

    if (subtitle) {
      const sH = textHeight(subtitle, T.sizes.coverSub, W, T, 0.1);
      s.addText(subtitle, txt({ x: M, y, w: W, h: sH, fontSize: T.sizes.coverSub,
        color: P.coverSub, fontFace: T.jp, valign: "top" }));
      push({ kind: "text", group: "cover", x: M, y, w: W, h: sH, text: subtitle, size: T.sizes.coverSub, color: "coverSub" });
      y += sH + 0.5;
    }

    if (kpis.length) {
      const ky = Math.max(4.3, y);
      s.addShape(this.pres.ShapeType.line, { x: M, y: ky, w: W, h: 0, line: { color: P.coverRule, width: 0.75 } });
      const slot = W / kpis.length;
      kpis.forEach((k, i) => {
        const x = M + i * slot;
        s.addText(k.value, txt({ x, y: ky + 0.25, w: slot - 0.3, h: 0.55, fontSize: T.sizes.coverKpi,
          bold: true, color: P.coverText, fontFace: T.num }));
        s.addText(k.label, txt({ x, y: ky + 0.85, w: slot - 0.3, h: 0.5, fontSize: 10, color: P.coverFaint, fontFace: T.jp }));
        push({ kind: "text", group: "cover-kpi-" + i, x, y: ky + 0.25, w: slot - 0.3, h: 0.55, text: k.value, size: T.sizes.coverKpi, color: "coverText" });
        push({ kind: "text", group: "cover-kpi-" + i, x, y: ky + 0.85, w: slot - 0.3, h: 0.5, text: k.label, size: 10, color: "coverFaint" });
      });
    }

    const note = asOfNote || `${this.asOf}｜公開情報に基づく整理`;
    s.addText(note, txt({ x: M, y: 6.5, w: 8, h: 0.3, fontSize: 10, color: P.coverFaint, fontFace: T.jp }));
    if (legend !== false) {
      s.addText(legendText(this.theme), txt({ x: M, y: 6.88, w: W, h: 0.3, fontSize: 8.5,
        color: P.coverFaint, fontFace: T.jp }));
    }
    this.manifest.slides.push(rec);
    return s;
  }

  /** 本文スライド。タイトル・ヘッドメッセージ・区切り線・フッタを自動で置く。 */
  slide({ title, head, source }) {
    const { P, T, G } = this;
    this.page += 1;
    const s = this.pres.addSlide();
    s.background = { color: P.paper };
    const M = G.margin;
    const W = G.slideW - M * 2;

    const rec = { no: this.page, title, head, source: source || "", items: [] };
    this.manifest.slides.push(rec);

    s.addText(title, txt({ x: M, y: G.titleY, w: W, h: 0.26, fontSize: T.sizes.title, bold: true,
      color: P.textMuted, fontFace: T.jp, charSpacing: 1.2, valign: "middle" }));
    rec.items.push({ kind: "text", group: "hdr-title", x: M, y: G.titleY, w: W, h: 0.26, text: title, size: T.sizes.title, role: "title", color: "textMuted" });

    s.addText(head, txt({ x: M, y: G.headY, w: W, h: G.headH, fontSize: T.sizes.head, bold: true,
      color: P.primary, fontFace: T.jp, valign: "top", lineSpacingMultiple: 1.15 }));
    rec.items.push({ kind: "text", group: "hdr-head", x: M, y: G.headY, w: W, h: G.headH, text: head, size: T.sizes.head, role: "head", color: "primary" });

    s.addShape(this.pres.ShapeType.line, { x: M, y: G.headRuleY, w: W, h: 0, line: { color: P.primary, width: 1 } });
    s.addShape(this.pres.ShapeType.line, { x: M, y: G.footRuleY, w: W, h: 0,
      line: { color: P.rule, width: 0.75, dashType: this.theme.rules.footRuleStyle } });

    s.addText("出典：" + (source || ""), txt({ x: M, y: G.footY, w: W - 0.7, h: 0.28,
      fontSize: T.sizes.note, color: P.textMuted, fontFace: T.jp, valign: "middle" }));
    s.addText(String(this.page), txt({ x: G.slideW - M - 0.7, y: G.footY, w: 0.7, h: 0.28,
      fontSize: 9, color: P.textMuted, fontFace: T.num, align: "right", valign: "middle" }));
    rec.items.push({ kind: "text", group: "footer", x: M, y: G.footY, w: W - 0.7, h: 0.28,
      text: "出典：" + (source || ""), size: T.sizes.note, role: "source", color: "textMuted" });

    return new Slide(this, s, rec);
  }

  async save(outPath) {
    await this.pres.writeFile({ fileName: outPath });
    const mPath = outPath.replace(/\.pptx$/, "") + ".manifest.json";
    this.manifest.grid = this.G;
    this.manifest.type = this.T;
    this.manifest.rules = this.theme.rules;
    this.manifest.palette = this.P; // check_contrast.py に manifest を直接渡せる
    fs.writeFileSync(mPath, JSON.stringify(this.manifest, null, 2));
    return { pptx: outPath, manifest: mPath };
  }
}

/* ---------- Slide --------------------------------------------------------- */

class Slide {
  constructor(deck, s, rec) {
    this.d = deck;
    this.s = s;
    this.rec = rec;
    this.g = 0; // グループ連番。同一グループ内の重なりは意図的とみなす
  }
  get P() { return this.d.P; }
  get T() { return this.d.T; }
  get G() { return this.d.G; }
  get sp() { return this.d.pres.ShapeType; }

  /** 色の役割名 → hex。生の hex を書かせないための関門。 */
  c(role) {
    if (!role) return undefined;
    const v = this.P[role];
    if (!v) throw new Error(`未定義の色役割: "${role}"。テーマの palette に無い色は使えない`);
    return v;
  }

  group(name) { this.g += 1; return name ? `${name}-${this.g}` : `g${this.g}`; }

  /* ----- 領域 ---------------------------------------------------------------
   * ボディを下端まで使い切るための矩形を返す。座標を手で決めない。
   * preset: full | chart-pane | pane-chart | two | three | top-bottom
   * o.note  : true なら下端に脚注 1 行ぶん（0.45in）を空ける
   * o.split : 主領域の比率（chart-pane の既定 0.58、top-bottom の既定 0.45）
   * o.gap   : 領域間の間隔（既定 0.5）
   * ------------------------------------------------------------------------ */
  regions(preset = "full", o = {}) {
    const G = this.G, M = G.margin, W = G.slideW - M * 2;
    const gap = o.gap === undefined ? 0.5 : o.gap;
    const y = o.y === undefined ? G.bodyTop : o.y;
    const bottom = (o.bottom === undefined ? G.bodyBottom : o.bottom) - (o.note ? 0.45 : 0);
    const h = bottom - y;
    const R = (x, w, yy = y, hh = h) => ({ x: r2(x), y: r2(yy), w: r2(w), h: r2(hh), right: r2(x + w), bottom: r2(yy + hh) });
    switch (preset) {
      case "full": return { main: R(M, W) };
      case "chart-pane": {
        const cw = (W - gap) * (o.split === undefined ? 0.58 : o.split);
        return { chart: R(M, cw), pane: R(M + cw + gap, W - cw - gap) };
      }
      case "pane-chart": {
        const pw = (W - gap) * (o.split === undefined ? 0.42 : o.split);
        return { pane: R(M, pw), chart: R(M + pw + gap, W - pw - gap) };
      }
      case "two": {
        const cw = (W - gap) * (o.split === undefined ? 0.5 : o.split);
        return { left: R(M, cw), right: R(M + cw + gap, W - cw - gap) };
      }
      case "three": {
        const cw = (W - gap * 2) / 3;
        return { a: R(M, cw), b: R(M + cw + gap, cw), c: R(M + (cw + gap) * 2, cw) };
      }
      case "top-bottom": {
        const th = (h - gap) * (o.split === undefined ? 0.45 : o.split);
        return { top: R(M, W, y, th), bottom: R(M, W, y + th + gap, h - th - gap) };
      }
      default:
        throw new Error(`未知の領域プリセット: "${preset}"`);
    }
  }

  /** 領域の上に見出しラベルを置き、残りの内側矩形を返す。 */
  labeled(r, str, group) {
    this.label(str, r.x, r.y, r.w, group);
    const y = r.y + 0.38;
    return { x: r.x, y, w: r.w, h: r2(r.h - 0.38), right: r.right, bottom: r.bottom };
  }

  /** 素のテキスト。size は theme.type.sizes のキー名、または pt 数値。 */
  text(str, o = {}) {
    const size = typeof o.size === "string" ? this.T.sizes[o.size] : (o.size || this.T.sizes.body);
    const color = o.color || "primary";
    const opt = txt({
      x: o.x, y: o.y, w: o.w, h: o.h,
      fontSize: size, bold: !!o.bold,
      color: this.c(color),
      fontFace: o.mono ? this.T.num : this.T.jp,
      align: o.align || "left", valign: o.valign || "top",
      lineSpacingMultiple: o.lineSpacing || 1.15,
      charSpacing: o.charSpacing,
    });
    this.s.addText(str, opt);
    this.rec.items.push({
      kind: "text", group: o.group || "free", x: o.x, y: o.y, w: o.w, h: o.h,
      text: String(str), size, color, role: o.role || null, noWrapCheck: !!o.noWrapCheck,
    });
    return this;
  }

  /** 見出しラベル（小さいグレーの section label）。 */
  label(str, x, y, w, group) {
    return this.text(str, { x, y, w, h: 0.24, size: "sectionLabel", bold: true,
      color: "textMuted", charSpacing: 0.8, valign: "middle", group, role: "label" });
  }

  /** 矩形。角丸は使わない。 */
  box(o) {
    const line = { color: this.c(o.stroke || "primary"), width: o.strokeW === undefined ? 0.75 : o.strokeW };
    if (o.dash) line.dashType = o.dash;
    const shape = { x: o.x, y: o.y, w: o.w, h: o.h, line };
    shape.fill = o.fill ? { color: this.c(o.fill) } : { color: this.P.paper, transparency: 100 };
    this.s.addShape(this.sp.rect, shape);
    // 副色の面積は「塗り」だけを数える。線だけの枠は視覚的な重みが桁違いに軽い。
    let secArea = 0;
    if (o.fill === "secondary") secArea = o.w * o.h;
    else if (o.fill === "secondaryPale") secArea = o.w * o.h * 0.35;
    const secondary = secArea > 0 || o.stroke === "secondary";
    this.rec.items.push({ kind: "rect", group: o.group || "free", x: o.x, y: o.y, w: o.w, h: o.h,
      fill: o.fill || null, stroke: o.stroke || "primary", area: secArea, secondary });
    return this;
  }

  line(o) {
    const l = { color: this.c(o.color || "primary"), width: o.width || 0.75 };
    if (o.dash) l.dashType = o.dash;
    this.s.addShape(this.sp.line, { x: o.x, y: o.y, w: o.w || 0, h: o.h || 0, line: l });
    return this;
  }

  circle(o) {
    this.s.addShape(this.sp.ellipse, {
      x: o.x - o.r, y: o.y - o.r, w: o.r * 2, h: o.r * 2,
      fill: o.fill ? { color: this.c(o.fill) } : { color: this.P.paper },
      line: { color: this.c(o.stroke || "primary"), width: o.strokeW === undefined ? 0 : o.strokeW },
    });
    return this;
  }

  arrow(o) {
    this.s.addShape(o.dir === "down" ? this.sp.downArrow : this.sp.rightArrow, {
      x: o.x, y: o.y, w: o.w || 0.6, h: o.h || 0.3,
      fill: { color: this.c(o.color || "primary") }, line: { width: 0 },
    });
    return this;
  }

  /** 枠を超えた内容を台帳に記録する。check_layout.py が ERROR にする。 */
  overflow(kind, group, o, need) {
    this.rec.items.push({ kind: "overflow", group, x: o.x, y: o.y, w: o.w, h: o.h,
      need: r2(need), what: kind });
  }

  /* ----- 複合コンポーネント ----------------------------------------------- */

  /**
   * 縦棒グラフ。ネイティブのグラフ機能を使わないのは、
   * 「特定の棒だけ secondary にする」という意味づけを確実に通すため。
   * h は**軸ラベルと値ラベルを含む総高さ**。regions() の矩形をそのまま渡せる。
   * data: [{label, value, accent?, plan?, display?}]
   *   accent → 副色（主題。1 枚 1 本が原則）  plan → 点線・白抜き（予定・推計）
   */
  bars(o) {
    const g = this.group("bars");
    const { x, y, w, h } = o;
    const data = o.data;
    const max = o.max || niceMax(Math.max(...data.map((d) => d.value)));
    const axisW = o.axisW === undefined ? 0.62 : o.axisW;
    const headroom = o.headroom === undefined ? 0.3 : o.headroom; // 値ラベルの逃げ
    const labelH = o.labelH || 0.26;
    const plotX = x + axisW, plotW = w - axisW;
    const base = y + h - labelH - 0.08;
    const plotH = base - (y + headroom);
    const ticks = o.ticks || 4;

    for (let i = 0; i <= ticks; i++) {
      const v = (max / ticks) * i;
      const ty = base - (v / max) * plotH;
      this.line({ x: plotX, y: ty, w: plotW, color: i === 0 ? "primary" : "ruleFaint",
        width: i === 0 ? 1 : 0.75, dash: i === 0 ? undefined : "sysDot" });
      this.text(fmtNum(v, o.decimals), { x, y: ty - 0.11, w: axisW - 0.1, h: 0.22,
        size: "note", color: "textMuted", align: "right", mono: true, group: g, noWrapCheck: true });
    }

    const slot = plotW / data.length;
    const bw = Math.min(o.barW || slot * 0.6, slot - 0.08);
    data.forEach((d, i) => {
      const bh = (d.value / max) * plotH;
      const bx = plotX + i * slot + (slot - bw) / 2;
      const acc = !!d.accent, plan = !!d.plan;
      const tone = acc ? "secondary" : "primary";
      this.box({ x: bx, y: base - bh, w: bw, h: bh,
        fill: plan ? null : tone, stroke: tone,
        strokeW: plan ? 1.25 : 0, dash: plan ? "dash" : undefined, group: g });
      if (d.showValue !== false) {
        this.text(d.display || fmtNum(d.value, o.decimals), {
          x: bx - 0.3, y: base - bh - 0.28, w: bw + 0.6, h: 0.26, size: "small", bold: true,
          color: tone, align: "center", mono: true, group: g, noWrapCheck: true });
      }
      this.text(d.label, { x: bx - 0.3, y: base + 0.08, w: bw + 0.6, h: labelH,
        size: "note", color: acc ? "secondary" : "textMuted", align: "center",
        mono: !!o.monoLabels, group: g });
    });
    return { base, plotX, plotW, slot, max, bottom: y + h };
  }

  /**
   * 横向きの比例バー。幅＝量。数字を並べるより訴求が強い。
   * h を渡すと行高を h に合わせて配分する（上限 0.62）。
   */
  hbars(o) {
    const g = this.group("hbars");
    const max = o.max || Math.max(...o.data.map((d) => d.value));
    const labelW = o.labelW || 1.9;
    const barX = o.x + labelW;
    const barW = o.w - labelW - (o.valueW || 0.9);
    const rowH = o.rowH || (o.h ? Math.min(0.62, o.h / o.data.length) : 0.46);
    o.data.forEach((d, i) => {
      const yy = o.y + i * rowH;
      this.text(d.label, { x: o.x, y: yy, w: labelW - 0.12, h: rowH - 0.06, size: "small",
        align: "right", color: d.ghost ? "textMuted" : "primary", valign: "middle", group: g });
      const wdt = Math.max((d.value / max) * barW, 0.02);
      this.box({ x: barX, y: yy + 0.05, w: wdt, h: rowH - 0.16,
        fill: d.ghost ? null : (d.accent ? "secondary" : "primary"),
        stroke: d.ghost ? "muted" : (d.accent ? "secondary" : "primary"),
        strokeW: d.ghost ? 1 : 0, dash: d.ghost ? "dash" : undefined, group: g });
      this.text(d.display || fmtNum(d.value, o.decimals), { x: barX + wdt + 0.12, y: yy,
        w: o.valueW || 0.9, h: rowH - 0.06, size: "small", mono: true, valign: "middle",
        color: d.ghost ? "textMuted" : (d.accent ? "secondary" : "primary"), group: g, noWrapCheck: true });
    });
    return { bottom: o.y + o.data.length * rowH };
  }

  /**
   * 階段図。規模の推移を「面積ではなく高さの相対」で見せる。
   * h は下のラベル・注記を含む総高さ。
   * steps: [{label, caption, note, ratio(0-1), accent?, plan?}]
   */
  stairs(o) {
    const g = this.group("stairs");
    const hasNote = o.steps.some((st) => st.note);
    const reserve = hasNote ? 1.05 : 0.4;
    const base = o.y + o.h - reserve;
    const plotH = base - o.y;
    this.line({ x: o.x, y: base, w: o.w, color: "primary", width: 1 });
    const slot = o.w / o.steps.length;
    const bw = slot - (o.padding === undefined ? 0.42 : o.padding);
    o.steps.forEach((st, i) => {
      const bx = o.x + i * slot + (slot - bw) / 2;
      const bh = st.ratio * plotH;
      const plan = !!st.plan, acc = !!st.accent;
      const tone = acc ? "secondary" : "primary";
      this.box({ x: bx, y: base - bh, w: bw, h: bh,
        fill: plan ? null : (acc ? "secondary" : "pale"),
        stroke: plan ? tone : (acc ? "secondary" : "rule"),
        strokeW: plan ? 1.25 : 0.75, dash: plan ? "dash" : undefined, group: g });
      this.text(st.caption, { x: bx + 0.08, y: base - bh + 0.12, w: bw - 0.16, h: 0.7,
        size: "small", bold: true, align: "center", lineSpacing: 1.05, group: g,
        color: acc ? "inverse" : "primary" });
      this.text(st.label, { x: bx, y: base + 0.1, w: bw, h: 0.26, size: "cardTitle", bold: true,
        align: "center", mono: true, color: tone, group: g, noWrapCheck: true });
      if (st.note) {
        this.text(st.note, { x: bx - 0.12, y: base + 0.4, w: bw + 0.24, h: 0.62, size: "note",
          color: "textMuted", align: "center", lineSpacing: 1.1, group: g });
      }
    });
    return { base, bottom: o.y + o.h };
  }

  /**
   * カード列。比較・ポートフォリオ用。h 省略時はボディ下端まで。
   * cards:[{title, sub, rows:[[k,v]], accent}]
   */
  cards(o) {
    const gap = o.gap === undefined ? 0.34 : o.gap;
    const h = o.h === undefined ? this.G.bodyBottom - o.y : o.h;
    const cw = (o.w - gap * (o.cards.length - 1)) / o.cards.length;
    o.cards.forEach((cd, i) => {
      const g = this.group("card");
      const x = o.x + i * (cw + gap);
      const headH = o.headH || 0.72;
      this.box({ x, y: o.y, w: cw, h: headH, fill: cd.accent ? "secondary" : "primary",
        stroke: cd.accent ? "secondary" : "primary", strokeW: 0, group: g });
      this.text(cd.title, { x: x + 0.2, y: o.y + 0.1, w: cw - 0.4, h: 0.34, size: "cardTitle",
        bold: true, color: "inverse", group: g });
      if (cd.sub) this.text(cd.sub, { x: x + 0.2, y: o.y + 0.45, w: cw - 0.4, h: 0.22,
        size: "note", color: "inverse", group: g });
      const bodyH = h - headH;
      this.box({ x, y: o.y + headH, w: cw, h: bodyH, stroke: "rule", group: g });
      let ry = o.y + headH + 0.16;
      (cd.rows || []).forEach(([k, v], j) => {
        const rh = 0.24 + textHeight(v, this.T.sizes.body, cw - 0.36, this.T, 0.1);
        this.text(k, { x: x + 0.18, y: ry, w: cw - 0.36, h: 0.2, size: "note", bold: true,
          color: "textMuted", charSpacing: 0.5, group: g });
        this.text(v, { x: x + 0.18, y: ry + 0.22, w: cw - 0.36, h: rh - 0.24, size: "body",
          lineSpacing: 1.1, group: g });
        ry += rh;
        if (j < cd.rows.length - 1) this.line({ x: x + 0.18, y: ry - 0.08, w: cw - 0.36, color: "ruleFaint" });
      });
      if (ry > o.y + h + 0.02) this.overflow("card", g, { x, y: o.y, w: cw, h }, ry - o.y);
    });
    return { cw, bottom: o.y + h };
  }

  /** 表。ヘッダ行は塗り。cols:[{label,w,align,mono}]  rows:[{cells, __accent?}] */
  table(o) {
    const g = this.group("table");
    const totalW = o.cols.reduce((a, c) => a + c.w, 0);
    const scale = o.w / totalW;
    const hh = o.headH || 0.34;
    this.box({ x: o.x, y: o.y, w: o.w, h: hh, fill: "primary", stroke: "primary", strokeW: 0, group: g });
    let cx = o.x;
    o.cols.forEach((c) => {
      this.text(c.label, { x: cx + 0.12, y: o.y, w: c.w * scale - 0.24, h: hh, size: "note",
        bold: true, color: "inverse", valign: "middle", align: c.align || "left", group: g });
      cx += c.w * scale;
    });
    let ry = o.y + hh;
    o.rows.forEach((row, i) => {
      const rh = o.rowH || Math.max(0.38, maxRowH(row, o.cols, scale, this.T));
      if (o.zebra !== false && i % 2 === 1) {
        this.box({ x: o.x, y: ry, w: o.w, h: rh, fill: "pale", stroke: "pale", strokeW: 0, group: g });
      }
      // 強調行は文字色だけを副色にする。淡色面を敷くと副色の面積が膨らみ、主題がぼける
      if (row.__accent && o.accentFill) {
        this.box({ x: o.x, y: ry, w: o.w, h: rh, fill: "secondaryPale", stroke: "secondaryPale", strokeW: 0, group: g });
      }
      let x2 = o.x;
      o.cols.forEach((c, j) => {
        this.text(row.cells[j], { x: x2 + 0.12, y: ry, w: c.w * scale - 0.24, h: rh, size: "small",
          color: row.__accent && j <= 1 ? "secondary" : "body", bold: !!row.__accent,
          align: c.align || "left", mono: !!c.mono, valign: "middle", lineSpacing: 1.15, group: g });
        x2 += c.w * scale;
      });
      this.line({ x: o.x, y: ry + rh, w: o.w, color: "ruleFaint" });
      ry += rh;
    });
    if (o.h && ry > o.y + o.h + 0.02) this.overflow("table", g, o, ry - o.y);
    return { bottom: ry };
  }

  /** 大きな数値の並び。kpis:[{value,label,accent}] */
  kpis(o) {
    const gap = o.gap === undefined ? 0.3 : o.gap;
    const h = o.h || 1.1;
    const kw = (o.w - gap * (o.kpis.length - 1)) / o.kpis.length;
    o.kpis.forEach((k, i) => {
      const g = this.group("kpi");
      const x = o.x + i * (kw + gap);
      if (o.framed !== false) this.box({ x, y: o.y, w: kw, h, stroke: k.accent ? "secondary" : "rule",
        strokeW: k.accent ? 1 : 0.75, group: g });
      this.text(k.value, { x: x + 0.16, y: o.y + 0.12, w: kw - 0.32, h: 0.42, size: "kpi", bold: true,
        color: k.accent ? "secondary" : "primary", mono: true, group: g, noWrapCheck: true });
      this.text(k.label, { x: x + 0.16, y: o.y + 0.56, w: kw - 0.32, h: h - 0.68, size: "small",
        color: "body", lineSpacing: 1.1, group: g });
    });
    return { bottom: o.y + h };
  }

  /**
   * 横タイムライン。events:[{date,title,note,future?,accent?,side:'up'|'down'}]
   * future → 点線・白抜き（予定）。色は変えない。accent → 副色（主題。1 つだけ）
   */
  timeline(o) {
    const solidTo = o.solidRatio === undefined ? 0.5 : o.solidRatio;
    const cut = o.x + o.w * solidTo;
    this.line({ x: o.x, y: o.y, w: cut - o.x, color: "primary", width: 1.5 });
    this.line({ x: cut, y: o.y, w: o.x + o.w - cut, color: "primary", width: 1.5, dash: "dash" });
    const slot = o.w / o.events.length;
    o.events.forEach((e, i) => {
      const g = this.group("tl");
      const cx = o.x + i * slot + slot / 2;
      const tone = e.accent ? "secondary" : "primary";
      this.circle({ x: cx, y: o.y, r: 0.11, fill: e.future ? "paper" : tone,
        stroke: tone, strokeW: e.future ? 1.75 : 0 });
      const up = e.side !== "down";
      const bh = o.cardH || 1.05;
      const by = up ? o.y - 0.3 - bh : o.y + 0.3;
      this.line({ x: cx, y: up ? by + bh : o.y + 0.06, h: 0.24, color: tone, dash: e.future ? "dash" : undefined });
      this.box({ x: cx - slot / 2 + 0.16, y: by, w: slot - 0.32, h: bh,
        stroke: e.accent ? "secondary" : "rule",
        strokeW: e.accent ? 1 : 0.75, dash: e.future ? "dash" : undefined, group: g });
      this.text(e.date, { x: cx - slot / 2 + 0.28, y: by + 0.1, w: slot - 0.56, h: 0.24, size: "small",
        bold: true, color: e.accent ? "secondary" : "textMuted", mono: true, group: g });
      this.text(e.title, { x: cx - slot / 2 + 0.28, y: by + 0.36, w: slot - 0.56, h: 0.34, size: "small",
        bold: true, color: tone, lineSpacing: 1.0, group: g });
      if (e.note) this.text(e.note, { x: cx - slot / 2 + 0.28, y: by + 0.72, w: slot - 0.56, h: 0.28,
        size: "note", color: "body", group: g });
    });
  }

  /**
   * 解釈ペイン。図の隣に置く「読み取り」の箱。図を単独で置かないための部品。
   * items:[{lead, body, accent?}]  lead は数値を含む 1 行の要点、body はその説明。
   * h 省略時はボディ下端まで。内容が h を超えたら台帳に overflow を記録する。
   */
  pane(o) {
    const g = this.group("pane");
    const T = this.T;
    const { x, w } = o;
    const h = o.h === undefined ? this.G.bodyBottom - o.y : o.h;
    let cy = o.y;
    if (o.title) { this.label(o.title, x, cy, w, g); cy += 0.38; }
    const numW = o.numbered ? 0.42 : 0;
    const tx = x + numW, tw = w - numW;
    const bodySize = T.sizes.body;
    o.items.forEach((it, i) => {
      const leadH = textHeight(it.lead, bodySize, tw, T, 0.06);
      const bodyH = it.body ? textHeight(it.body, bodySize, tw, T, 0.06) : 0;
      if (o.numbered) {
        this.text(String(i + 1).padStart(2, "0"), { x, y: cy, w: numW - 0.08, h: leadH, size: "small",
          bold: true, mono: true, color: it.accent ? "secondary" : "textMuted", group: g, noWrapCheck: true });
      }
      this.text(it.lead, { x: tx, y: cy, w: tw, h: leadH, size: "body", bold: true,
        color: it.accent ? "secondary" : "primary", lineSpacing: 1.15, group: g });
      if (it.body) {
        this.text(it.body, { x: tx, y: cy + leadH + 0.02, w: tw, h: bodyH, size: "body",
          color: "body", lineSpacing: 1.2, group: g });
      }
      cy += leadH + (it.body ? bodyH + 0.02 : 0) + 0.14;
      if (i < o.items.length - 1) {
        this.line({ x, y: cy, w, color: "ruleFaint" });
        cy += 0.16;
      }
    });
    if (cy > o.y + h + 0.02) this.overflow("pane", g, { x, y: o.y, w, h }, cy - o.y);
    return { bottom: cy };
  }

  /**
   * 所見の囲み。既定は主色の実線枠＋本文（副色を使わない）。
   * accent:true で副色の枠と文字（1 枚 1 箇所の主題にだけ）。warn:true で破線＝注意・別件。
   */
  callout(str, o = {}) {
    const g = this.group("call");
    const stroke = o.warn ? "muted" : (o.accent ? "secondary" : "primary");
    const color = o.warn ? "textMuted" : (o.accent ? "secondary" : "primary");
    this.box({ x: o.x, y: o.y, w: o.w, h: o.h, stroke, strokeW: 1,
      dash: o.warn ? "dash" : undefined, group: g });
    this.text(str, { x: o.x + 0.18, y: o.y + 0.1, w: o.w - 0.36, h: o.h - 0.2, size: "small",
      bold: !o.warn, color, valign: "middle", lineSpacing: 1.15, group: g });
  }

  /** 脚注。ボディ下端に置く小さな注記。 */
  note(str, o = {}) {
    return this.text(str, { x: o.x || this.G.margin, y: o.y || this.G.bodyBottom - 0.22,
      w: o.w || this.G.slideW - this.G.margin * 2, h: 0.26, size: "note", color: "textMuted", group: "note", role: "note" });
  }
}

/* ---------- helpers ------------------------------------------------------- */

function r2(v) { return Math.round(v * 1000) / 1000; }

function txt(o) {
  const r = Object.assign({ isTextBox: true, margin: 0 }, o);
  Object.keys(r).forEach((k) => r[k] === undefined && delete r[k]);
  return r;
}

function fmtNum(v, decimals) {
  if (decimals !== undefined) return v.toFixed(decimals);
  return Number.isInteger(v) ? v.toLocaleString() : String(v);
}

function niceMax(v) {
  if (v <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) {
    if (v <= mag * m) return mag * m;
  }
  return mag * 10;
}

function maxRowH(row, cols, scale, type) {
  let h = 0;
  row.cells.forEach((cell, j) => {
    const lines = estLines(cell, type.sizes.small, cols[j].w * scale - 0.24, type);
    h = Math.max(h, 0.16 + lines * (type.sizes.small / 72) * type.lineFactor);
  });
  return h;
}

function legendText(theme) {
  return theme.name === "mono"
    ? "凡例　塗り＝主題　白抜き＝構造　実線＝実績　点線＝予定・推計"
    : "凡例　■ 主色＝事業構造・確定実績　■ 副色＝変化点／主題　実線＝実績　点線＝予定・推計";
}

/** 白と混ぜて淡色を作る。ratio は元色の残存率（0.12 なら 12%）。 */
function tint(hex, ratio) {
  const ch = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return ch.map((c) => Math.round(255 - (255 - c) * ratio).toString(16).padStart(2, "0")).join("").toUpperCase();
}

/**
 * ブランド色を 3 役に写像する。渡せるのは secondary（必須）と primary（任意）。
 * secondaryPale は自動で導く。コントラストの検査は scripts/check_contrast.py で行う
 * （manifest.json をそのまま渡せる）。
 */
function applyBrand(theme, brand) {
  if (!brand) return theme;
  for (const k of ["secondary", "primary"]) {
    if (brand[k] === undefined) continue;
    if (!/^[0-9A-Fa-f]{6}$/.test(brand[k])) {
      throw new Error(`brand.${k} は # なしの 6 桁 hex で渡す: "${brand[k]}"`);
    }
    theme.palette[k] = brand[k].toUpperCase();
  }
  if (brand.secondary) theme.palette.secondaryPale = tint(theme.palette.secondary, 0.12);
  if (brand.primary) {
    theme.palette.coverText = theme.palette.coverBg === "FFFFFF" ? theme.palette.primary : theme.palette.coverText;
  }
  theme.brand = { secondary: theme.palette.secondary, primary: brand.primary ? theme.palette.primary : null,
    source: brand.source || null };
  return theme;
}

function loadTheme(nameOrObj, overrides, brand) {
  let t;
  if (typeof nameOrObj === "object") t = JSON.parse(JSON.stringify(nameOrObj));
  else {
    const p = path.join(__dirname, "themes", `${nameOrObj}.json`);
    if (!fs.existsSync(p)) throw new Error(`テーマが見つからない: ${nameOrObj}`);
    t = JSON.parse(fs.readFileSync(p, "utf8"));
  }
  if (overrides) deepMerge(t, overrides);
  applyBrand(t, brand);
  for (const k of ["paper", "primary", "secondary", "muted", "rule", "pale"]) {
    if (!t.palette[k]) throw new Error(`テーマに必須の色役割 "${k}" が無い`);
    if (/^#/.test(t.palette[k])) throw new Error(`色に "#" を付けてはいけない: ${k}`);
  }
  return t;
}

function deepMerge(a, b) {
  for (const k of Object.keys(b)) {
    if (b[k] && typeof b[k] === "object" && !Array.isArray(b[k])) {
      a[k] = a[k] || {};
      deepMerge(a[k], b[k]);
    } else a[k] = b[k];
  }
  return a;
}

module.exports = { Deck, Slide, textWidthIn, estLines, textHeight, isFullWidth, niceMax, applyBrand, loadTheme, tint };
