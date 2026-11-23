"use client";

import { useRef, useState } from "react";
import { fetchRecommendations, type RecommendationResult } from "@/lib/api";

// 検索画面タブ（送別ギフトのおすすめを、予算と年代で絞って、投票の候補にチェックを付ける）
// チェックの状態は page.tsx が持っていて、props で受け取る
export type SearchTabProps = {
  selectedIds: string[]; // 今チェックが入っている商品ID
  onToggle: (productId: string) => void; // チェックを入れる・外す
  isFull: boolean; // 5件選んでいて、もう選べないとき true
};

const SCENE_CODE = "farewell"; // おすすめAPIのシーン
const PAGE_SIZE = 20;          // 1ページの件数

// 予算スライダー（1本のバーの両端を動かして、下限と上限を選ぶ）
//   範囲は 0〜15,000円、1,000円刻み
//   下限が0円のときは「下限なし」、上限が15,000円のときは「上限なし」（15,000円を超える商品も入る）
const PRICE_MAX = 15000;
const PRICE_STEP = 1000;

// 相手の年代の選択肢（API の age_group と同じ表記）
const AGES = ["10代", "20代", "30代", "40代", "50代", "60代以上"];

// 検索ボタンを押した時点の条件（ページ送りは、この条件のまま行う）
type Searched = { age: string; min?: number; max?: number };

// 「前へ」「次へ」ボタンの見た目
const pagerStyle: React.CSSProperties = {
  height: "44px", padding: "0 24px", border: "1px solid var(--line-strong)", borderRadius: "var(--radius-control)",
  background: "var(--surface)", color: "var(--ink)", fontSize: "15px", fontFamily: "inherit", cursor: "pointer",
};

export default function SearchTab({ selectedIds, onToggle, isFull }: SearchTabProps) {
  const [lowPrice, setLowPrice] = useState(0);          // 予算の下限（0＝下限なし）
  const [highPrice, setHighPrice] = useState(PRICE_MAX); // 予算の上限（15,000＝上限なし）
  const [age, setAge] = useState("");                  // 選んだ年代
  const [searched, setSearched] = useState<Searched | null>(null); // 最後に検索した条件
  const [page, setPage] = useState(1);                 // 表示中のページ（1から）
  const [result, setResult] = useState<RecommendationResult | null>(null); // 検索結果（null は、まだ結果が来ていない）
  const [error, setError] = useState("");              // つながらないときの文言
  const [loading, setLoading] = useState(false);       // 検索中
  const latest = useRef(0);                            // 一番新しい検索の番号（古い検索の結果で上書きしないため）
  const top = useRef<HTMLDivElement>(null);            // ページを変えたとき、結果の先頭へ戻す位置

  // 条件とページを API に送り、点数の高い順の結果をもらう（結果が返るまで待つ＝async/await）
  async function load(cond: Searched, pageNumber: number) {
    const myNumber = ++latest.current;
    setLoading(true);
    try {
      const found = await fetchRecommendations(SCENE_CODE, {
        ageGroup: cond.age,
        priceMin: cond.min,
        priceMax: cond.max,
        limit: PAGE_SIZE,
        offset: (pageNumber - 1) * PAGE_SIZE,
      });
      if (myNumber !== latest.current) return; // もっと新しい検索があるので、この結果は使わない
      setError("");
      setResult(found);
      setPage(pageNumber);
    } catch (err) {
      if (myNumber !== latest.current) return;
      setResult(null);
      setError(`APIにつながりません：${(err as Error).message}`);
    } finally {
      if (myNumber === latest.current) setLoading(false);
    }
  }

  // 検索ボタン（押したときだけ検索する。1ページ目から）
  function onSearch(e: React.FormEvent) {
    e.preventDefault(); // ページの再読み込みを止める
    const cond: Searched = {
      age,
      min: lowPrice > 0 ? lowPrice : undefined,              // 0円は下限なし
      max: highPrice < PRICE_MAX ? highPrice : undefined,    // 15,000円は上限なし
    };
    setSearched(cond);
    load(cond, 1);
  }

  // ページ送り
  function goPage(n: number) {
    if (!searched) return;
    load(searched, n);
    top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // スライダーを動かす：下限が上限を超えないようにする
  // つまみを動かす：下限と上限が重ならないよう、最低1刻みは離す
  function onLow(v: number) { setLowPrice(Math.min(v, highPrice - PRICE_STEP)); }
  function onHigh(v: number) { setHighPrice(Math.max(v, lowPrice + PRICE_STEP)); }

  const totalPages = result ? Math.max(1, Math.ceil(result.totalCandidates / PAGE_SIZE)) : 1;
  const yen = (v: number) => `${v.toLocaleString()}円`;
  const budgetLabel = `${lowPrice === 0 ? "下限なし" : yen(lowPrice)} 〜 ${highPrice >= PRICE_MAX ? "上限なし" : yen(highPrice)}`;

  return (
    <section>
      {/* 検索フォーム（トップ画面と同じ見た目のクラスを使う） */}
      <form className="form" style={{ marginTop: 0 }} onSubmit={onSearch}>
        <div className="field" style={{ flex: "1 1 260px" }}>
          予算：{budgetLabel}
          {/* 1本のバーに、下限・上限の2つのつまみ（range を2枚重ねている。見た目は globals.css の .dualRange） */}
          <div className="dualRange">
            <div className="dualTrack" />
            <div
              className="dualFill"
              style={{ left: `${(lowPrice / PRICE_MAX) * 100}%`, right: `${100 - (highPrice / PRICE_MAX) * 100}%` }}
            />
            <input
              type="range" min={0} max={PRICE_MAX} step={PRICE_STEP}
              value={lowPrice} onChange={(e) => onLow(Number(e.target.value))}
              aria-label="予算の下限"
            />
            <input
              type="range" min={0} max={PRICE_MAX} step={PRICE_STEP}
              value={highPrice} onChange={(e) => onHigh(Number(e.target.value))}
              aria-label="予算の上限"
            />
          </div>
        </div>
        <label className="field sel">
          相手の年代
          <select value={age} onChange={(e) => setAge(e.target.value)}>
            <option value="">指定なし</option>
            {AGES.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </label>
        <button type="submit" disabled={loading}>検索</button>
      </form>

      {error && <p className="summary">{error}</p>}
      {!error && loading && <p className="summary">検索中…</p>}
      {!error && !loading && result === null && (
        <p className="summary">予算と年代を選んで、「検索」を押してください（指定しなくても検索できます）。</p>
      )}

      {result && (
        <div ref={top} style={{ marginTop: "20px", scrollMarginTop: "16px" }}>
          {/* 年代で0件だったので、年代を外して取り直したとき */}
          {result.relaxed && (
            <p style={{ color: "var(--accent)", fontWeight: "bold", fontSize: "14px" }}>
              年代に合う商品がないため、年代を指定せずに表示しています
            </p>
          )}

          <p className="summary">
            送別向けの商品 {result.totalCandidates} 件のうち、おすすめ順 {result.results.length > 0 ? `${result.results[0].rank}〜${result.results[result.results.length - 1].rank}` : 0} 件目（{page} / {totalPages} ページ）
          </p>
          {result.results.length === 0 && (
            <p className="summary">条件に合う商品がありません。予算を変えてみてください。</p>
          )}

          <div className="grid">
            {result.results.map((g) => {
              const checked = selectedIds.includes(g.id);
              const disabled = !checked && isFull; // 5件選んでいたら、ほかは選べない
              return (
                <article key={g.id} className="card" style={{ display: "flex", gap: "16px", alignItems: "flex-start", flexWrap: "wrap" }}>
                  <div style={{ width: "40px", fontSize: "22px", fontWeight: "bold", color: "var(--accent)" }}>{g.rank}</div>
                  <div style={{ flex: 1, minWidth: "220px" }}>
                    <p className="meta">{g.category}・{g.brand}</p>
                    <h3 className="name">{g.name}</h3>
                    <p className="price">{g.price.toLocaleString()}円</p>
                    <p className="meta">評価{g.rating}（{g.reviewCount}件）</p>

                    {/* 満たしている安心条件 */}
                    {g.reasons.conditions.length > 0 && (
                      <p style={{ margin: "8px 0 0" }}>
                        {g.reasons.conditions.map((c) => (
                          <span
                            key={c}
                            style={{ display: "inline-block", padding: "2px 10px", margin: "2px 6px 2px 0", borderRadius: "var(--radius-control)", backgroundColor: "var(--tint)", color: "var(--accent-dark)", fontSize: "13px" }}
                          >
                            {c}
                          </span>
                        ))}
                      </p>
                    )}

                    {/* 推薦理由 */}
                    <p className="meta" style={{ lineHeight: 1.7 }}>理由：{g.reasons.text}</p>

                    <label style={{ display: "inline-flex", alignItems: "center", gap: "8px", minHeight: "44px", marginTop: "4px", cursor: disabled ? "not-allowed" : "pointer" }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabled}
                        onChange={() => onToggle(g.id)}
                        style={{ width: "20px", height: "20px" }}
                      />
                      投票の候補に入れる
                    </label>
                  </div>
                </article>
              );
            })}
          </div>

          {/* ページ送り */}
          {totalPages > 1 && (
            <nav style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "16px", marginTop: "20px" }}>
              <button type="button" onClick={() => goPage(page - 1)} disabled={loading || page <= 1} style={pagerStyle}>前へ</button>
              <span style={{ fontSize: "14px", color: "var(--sub)" }}>{page} / {totalPages} ページ</span>
              <button type="button" onClick={() => goPage(page + 1)} disabled={loading || page >= totalPages} style={pagerStyle}>次へ</button>
            </nav>
          )}
        </div>
      )}
    </section>
  );
}
