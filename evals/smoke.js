/* slide-studio / スモークテスト。全コンポーネントを 1 回ずつ描く。
   使い方: node evals/smoke.js [theme] [outdir] */
const path = require("path");
const { Deck } = require(path.join(__dirname, "..", "assets", "deck.lib.js"));

const theme = process.argv[2] || "default";
const outdir = process.argv[3] || "/tmp/ss";
require("fs").mkdirSync(outdir, { recursive: true });

(async () => {
  const deck = new Deck({ theme, asOf: "2026-09-12" });
  const G = deck.G, M = G.margin, W = G.slideW - M * 2;

  deck.cover({
    eyebrow: "スモークテスト",
    title: "slide-studio コンポーネント確認",
    subtitle: "全プリミティブを 1 回ずつ描画し、レイアウト台帳の検査を通す",
    kpis: [
      { value: "13 枚", label: "前回実績の枚数" },
      { value: "9 件", label: "目視で検出した不具合" },
      { value: "6 件", label: "うち静的検査で検出可能" },
    ],
  });

  // 1. 縦棒グラフ + KPI
  {
    const s = deck.slide({
      title: "縦棒グラフ",
      head: "直近期の値が突出しており、副色を当てた 1 本だけが主題として読める",
      source: "スモークテスト用のダミー値",
    });
    s.label("推移（億円）", M, G.bodyTop, 7.0);
    s.bars({
      x: M, y: G.bodyTop + 0.38, w: 7.0, h: 3.4, decimals: 2, monoLabels: true,
      data: [
        { label: "FY19/3", value: 1.96 }, { label: "FY22/3", value: 4.78 },
        { label: "FY24/3", value: 5.88 }, { label: "FY25/3", value: 3.07 },
        { label: "FY26/3", value: 9.16, accent: true },
      ],
    });
    s.note("欠測年度は描かない。内挿で埋めない。");
    s.kpis({
      x: M + 7.5, y: G.bodyTop + 0.38, w: W - 7.5, h: 1.1,
      kpis: [{ value: "+198%", label: "前期比", accent: true }],
    });
    s.callout("副色は主題にのみ当てる。面積の上限をテーマが持っている。",
      { x: M + 7.5, y: G.bodyTop + 1.7, w: W - 7.5, h: 0.9 });
  }

  // 2. 横比例バー + 表
  {
    const s = deck.slide({
      title: "比例バーと表",
      head: "構成比は数字の羅列より幅で示したほうが差が伝わる",
      source: "スモークテスト用のダミー値",
    });
    s.label("出典の階層別内訳", M, G.bodyTop, W);
    s.hbars({
      x: M, y: G.bodyTop + 0.32, w: 6.2, labelW: 1.6, rowH: 0.5,
      data: [
        { label: "一次", value: 9 },
        { label: "二次", value: 10, accent: true },
        { label: "三次", value: 2, ghost: true },
      ],
    });
    s.table({
      x: M + 6.6, y: G.bodyTop + 0.32, w: W - 6.6,
      cols: [{ label: "#", w: 0.5, mono: true }, { label: "区分", w: 1.6 }, { label: "件数", w: 0.9, align: "right", mono: true }],
      rows: [
        { cells: ["01", "一次情報", "9"] },
        { cells: ["02", "報道・チャート", "10"], __accent: true },
        { cells: ["03", "百科・個人集計", "2"] },
      ],
    });
  }

  // 3. 階段図
  {
    const s = deck.slide({
      title: "階段図",
      head: "規模の推移は、実数ではなく相対の高さで見せるほうが伸びの形が伝わる",
      source: "スモークテスト用のダミー値",
    });
    s.label("主要公演の規模（高さは相対イメージ）", M, G.bodyTop, W);
    s.stairs({
      x: M, y: G.bodyTop + 0.5, w: W, h: 3.3,
      steps: [
        { label: "2019", caption: "ホール", note: "初回", ratio: 0.2 },
        { label: "2021", caption: "武道館", note: "ツアー最終", ratio: 0.35 },
        { label: "2023", caption: "アリーナ", note: "2DAYS", ratio: 0.6 },
        { label: "2026", caption: "スタジアム", note: "約 13.2 万人", ratio: 1.0, accent: true },
        { label: "2027", caption: "ドーム", note: "予定", ratio: 0.85, plan: true },
      ],
    });
  }

  // 4. カード列
  {
    const s = deck.slide({
      title: "カード列",
      head: "3 者の比較は同じ項目を同じ順で並べたときにだけ意味を持つ",
      source: "スモークテスト用のダミー値",
    });
    s.cards({
      x: M, y: G.bodyTop, w: W, h: 4.6,
      cards: [
        { title: "A 社", sub: "エーシャ", accent: true, rows: [["設立", "2017 年"], ["規模", "10 名"], ["直近", "過去最大の実績を更新した"]] },
        { title: "B 社", sub: "ビーシャ", rows: [["設立", "2019 年"], ["規模", "12 名"], ["直近", "初のアリーナ公演を完走"]] },
        { title: "C 社", sub: "シーシャ", rows: [["設立", "2022 年"], ["規模", "12 名"], ["直近", "定着の段階にある"]] },
      ],
    });
  }

  // 5. タイムライン
  {
    const s = deck.slide({
      title: "タイムライン",
      head: "実線と点線で実績と予定を分けると、どこまでが確定かが一目で分かる",
      source: "スモークテスト用のダミー値",
    });
    s.timeline({
      x: M, y: G.bodyTop + 1.6, w: W, solidRatio: 0.5,
      events: [
        { date: "2026/04", title: "体制変更", note: "新任" },
        { date: "2026/06", title: "最大規模公演", note: "13.2 万人", side: "down" },
        { date: "2026/10", title: "周年公演", note: "2DAYS", future: true },
        { date: "2027/01", title: "ドーム公演", note: "予定", future: true, side: "down" },
      ],
    });
    s.note("実線＝実施済　点線＝未実施", { y: G.bodyTop + 3.5 });
  }

  const out = path.join(outdir, `smoke-${theme}.pptx`);
  const r = await deck.save(out);
  console.log("pptx     :", r.pptx);
  console.log("manifest :", r.manifest);
})();
