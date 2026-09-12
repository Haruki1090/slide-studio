/* slide-studio / スモークテスト。全コンポーネントを 1 回ずつ描く。
   使い方: node evals/smoke.js [theme] [outdir]
          SS_BRAND=0055A4 node evals/smoke.js default .out/smoke   # ブランド色の写像も通す
   ここは規約の実例でもある。regions() で領域を切り、図には pane() で解釈を添え、
   副色は 1 枚 1 箇所、ボディは下端まで使う。 */
const path = require("path");
const { Deck } = require(path.join(__dirname, "..", "assets", "deck.lib.js"));

const theme = process.argv[2] || "default";
const outdir = process.argv[3] || "/tmp/ss";
const brand = process.env.SS_BRAND ? { secondary: process.env.SS_BRAND, source: "env SS_BRAND" } : undefined;
require("fs").mkdirSync(outdir, { recursive: true });

(async () => {
  const deck = new Deck({ theme, asOf: "2026-09-12", brand });
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

  // 1. 縦棒グラフ + 解釈ペイン（既定の型）
  {
    const s = deck.slide({
      title: "縦棒グラフ",
      head: "直近期の値は 9.16 億円と前期の 3 倍で、副色を当てた 1 本だけが主題として読める",
      source: "スモークテスト用のダミー値",
    });
    const r = s.regions("chart-pane", { note: true });
    s.bars({
      ...s.labeled(r.chart, "推移（億円）"), decimals: 2, monoLabels: true,
      data: [
        { label: "FY19/3", value: 1.96 }, { label: "FY22/3", value: 4.78 },
        { label: "FY24/3", value: 5.88 }, { label: "FY25/3", value: 3.07 },
        { label: "FY26/3", value: 9.16, accent: true },
        { label: "FY27/3", value: 9.5, plan: true, display: "9.5 (予)" },
      ],
    });
    s.pane({
      ...r.pane, title: "読み取り", numbered: true,
      items: [
        { lead: "FY26/3 は 9.16 億円で過去最高", body: "前期 3.07 億円から 3.0 倍。FY24/3 の 5.88 億円も上回った。" },
        { lead: "伸びは連続ではない", body: "FY25/3 に一度 3.07 億円へ落ちている。欠測年度（FY20〜21、FY23）は描いていない。" },
        { lead: "FY27/3 は会社予想", body: "点線は未実施の値。実績と同列に扱わない。" },
      ],
    });
    s.note("欠測年度は描かない。内挿で埋めない。FY27/3 は会社予想（点線）。");
  }

  // 2. 横比例バー + 表
  {
    const s = deck.slide({
      title: "比例バーと表",
      head: "出典の 21 件のうち一次と二次で 19 件を占め、三次情報は 2 件にとどまる",
      source: "スモークテスト用のダミー値",
    });
    const r = s.regions("two", { split: 0.48 });
    const L = s.labeled(r.left, "出典の階層別内訳（件）");
    s.hbars({
      x: L.x, y: L.y, w: L.w, h: 2.0, labelW: 1.6,
      data: [
        { label: "一次", value: 9 },
        { label: "二次", value: 10, accent: true },
        { label: "三次", value: 2, ghost: true },
      ],
    });
    s.callout("三次情報（百科・個人集計）は裏が取れた範囲だけを使い、出典にその旨を明記する。",
      { x: L.x, y: L.y + 2.3, w: L.w, h: 0.9 });
    s.callout("二次情報どうしの数値が 10% 超で食い違う項目が 1 件ある。両論併記にした。",
      { x: L.x, y: L.y + 3.5, w: L.w, h: 0.9, warn: true });
    const R = s.labeled(r.right, "出典一覧");
    s.table({
      x: R.x, y: R.y, w: R.w, h: R.h,
      cols: [{ label: "#", w: 0.5, mono: true }, { label: "区分", w: 1.8 }, { label: "媒体", w: 2.4 }, { label: "件数", w: 0.9, align: "right", mono: true }],
      rows: [
        { cells: ["01", "一次情報", "決算公告・企業サイト", "9"] },
        { cells: ["02", "報道・チャート", "業界紙・チャート運営元", "10"] },
        { cells: ["03", "百科・個人集計", "百科事典・個人ブログ", "2"] },
        { cells: ["", "合計", "", "21"] },
      ],
    });
  }

  // 3. 階段図 + ペイン（上下分割）
  {
    const s = deck.slide({
      title: "階段図",
      head: "公演規模は 4 段階で拡大し、2026 年のスタジアムで初回の約 5 倍に達した",
      source: "スモークテスト用のダミー値",
    });
    const r = s.regions("top-bottom", { split: 0.68 });
    s.stairs({
      ...s.labeled(r.top, "主要公演の規模（高さは相対イメージ）"),
      steps: [
        { label: "2019", caption: "ホール", note: "初回", ratio: 0.2 },
        { label: "2021", caption: "武道館", note: "ツアー最終", ratio: 0.35 },
        { label: "2023", caption: "アリーナ", note: "2DAYS", ratio: 0.6 },
        { label: "2026", caption: "スタジアム", note: "約 13.2 万人", ratio: 1.0, accent: true },
        { label: "2027", caption: "ドーム", note: "予定", ratio: 0.85, plan: true },
      ],
    });
    const b = s.regions("two", { y: r.bottom.y, bottom: r.bottom.bottom, split: 0.58 });
    s.pane({
      ...b.left,
      items: [
        { lead: "拡大は 2 年おきに 1 段ずつで、飛び級はない", body: "会場の階層（ホール → 武道館 → アリーナ → スタジアム）を順に踏んでいる。" },
      ],
    });
    s.callout("2027 年のドームは会社発表の予定であり、点線で区別した。動員の実績値は存在しない。",
      { x: b.right.x, y: b.right.y, w: b.right.w, h: b.right.h, warn: true });
  }

  // 4. カード列（下端まで）
  {
    const s = deck.slide({
      title: "カード列",
      head: "3 社のうち A 社だけが設立から 9 年で過去最大の実績を更新している",
      source: "スモークテスト用のダミー値",
    });
    const r = s.regions("full");
    s.cards({
      ...r.main,
      cards: [
        { title: "A 社", sub: "エーシャ", accent: true, rows: [["設立", "2017 年"], ["規模", "10 名"], ["直近", "過去最大の実績を更新した"]] },
        { title: "B 社", sub: "ビーシャ", rows: [["設立", "2019 年"], ["規模", "12 名"], ["直近", "初のアリーナ公演を完走"]] },
        { title: "C 社", sub: "シーシャ", rows: [["設立", "2022 年"], ["規模", "12 名"], ["直近", "定着の段階にある"]] },
      ],
    });
  }

  // 5. タイムライン + KPI + ペイン
  {
    const s = deck.slide({
      title: "タイムライン",
      head: "2026 年 6 月の最大規模公演を境に、以降の 2 件はすべて未実施の予定である",
      source: "スモークテスト用のダミー値",
    });
    const r = s.regions("top-bottom", { split: 0.58, note: true });
    s.timeline({
      x: r.top.x, y: r.top.y + 1.5, w: r.top.w, solidRatio: 0.5,
      events: [
        { date: "2026/04", title: "体制変更", note: "新任" },
        { date: "2026/06", title: "最大規模公演", note: "13.2 万人", side: "down", accent: true },
        { date: "2026/10", title: "周年公演", note: "2DAYS", future: true },
        { date: "2027/01", title: "ドーム公演", note: "予定", future: true, side: "down" },
      ],
    });
    const b = s.regions("two", { y: r.bottom.y, bottom: r.bottom.bottom });
    s.kpis({ x: b.left.x, y: b.left.y, w: b.left.w, h: b.left.h,
      kpis: [{ value: "13.2 万人", label: "2026/06 の動員。4 件のうち最大" }, { value: "2 件", label: "未実施の予定。実績値は無い" }] });
    s.pane({ ...b.right, items: [
      { lead: "実線と点線で実績と予定を分けた", body: "点線の 2 件は会社発表の予定であり、動員や売上の実績値は存在しない。" },
    ] });
    s.note("実線＝実施済　点線＝未実施");
  }

  const out = path.join(outdir, `smoke-${theme}${brand ? "-brand" : ""}.pptx`);
  const r = await deck.save(out);
  console.log("pptx     :", r.pptx);
  console.log("manifest :", r.manifest);
})();
