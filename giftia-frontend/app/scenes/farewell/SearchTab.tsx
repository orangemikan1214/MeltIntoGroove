"use client";

import { useEffect, useRef, useState } from "react";
import { fetchRecommendations, type RecommendationResult } from "@/lib/api";

// 検索画面タブ（送別ギフトのおすすめを、予算と年代で絞って、投票の候補にチェックを付ける）
// チェックの状態は page.tsx が持っていて、props で受け取る
export type SearchTabProps = {
  selectedIds: string[]; // 今チェックが入っている商品ID
  onToggle: (productId: string) => void; // チェックを入れる・外す
  isFull: boolean; // 5件選んでいて、もう選べないとき true
};

const SCENE_CODE = "farewell"; // おすすめAPIのシーン
const LIMIT = 20;              // 表示する件数

// 予算の選択肢 → API に送る下限・上限（空の項目は「指定なし」）
const BUDGETS = [
  { value: "", label: "すべての予算", min: undefined, max: undefined },
  { value: "under3000", label: "〜2,999円", min: undefined, max: 2999 },
  { value: "3000", label: "3,000〜4,999円", min: 3000, max: 4999 },
  { value: "5000", label: "5,000〜9,999円", min: 5000, max: 9999 },
  { value: "10000", label: "10,000円以上", min: 10000, max: undefined },
];

// 相手の年代の選択肢（API の age_group と同じ表記）
const AGES = ["10代", "20代", "30代", "40代", "50代", "60代以上"];

export default function SearchTab({ selectedIds, onToggle, isFull }: SearchTabProps) {
  const [budget, setBudget] = useState(""); // 選んだ予算
  const [age, setAge] = useState("");       // 選んだ年代
  const [result, setResult] = useState<RecommendationResult | null>(null); // 検索結果（null は、まだ結果が来ていない）
  const [error, setError] = useState("");   // つながらないときの文言
  const latest = useRef(0);                 // 一番新しい検索の番号（古い検索の結果で上書きしないため）

  // 条件を API に送り、点数の高い順の結果をもらう（結果が返るまで待つ＝async/await）
  async function runSearch(budgetValue: string, ageGroup: string) {
    const myNumber = ++latest.current;
    const range = BUDGETS.find((b) => b.value === budgetValue) ?? BUDGETS[0];
    try {
      const found = await fetchRecommendations(SCENE_CODE, { ageGroup, priceMin: range.min, priceMax: range.max, limit: LIMIT });
      if (myNumber !== latest.current) return; // もっと新しい検索があるので、この結果は使わない
      setError("");
      setResult(found);
    } catch (err) {
      if (myNumber !== latest.current) return;
      setResult(null);
      setError(`APIにつながりません：${(err as Error).message}`);
    }
  }

  // タブを開いたとき、条件なしで1回検索して、おすすめ順の送別ギフトを出す
  // （エフェクトの中では、通信が終わったあとの then / catch の中で setState する）
  useEffect(() => {
    let cancelled = false; // タブを閉じたあとに結果が返ってきても、何もしない
    fetchRecommendations(SCENE_CODE, { limit: LIMIT })
      .then((found) => { if (!cancelled) setResult(found); })
      .catch((err: Error) => { if (!cancelled) setError(`APIにつながりません：${err.message}`); });
    return () => { cancelled = true; };
  }, []);

  // 検索ボタン
  function onSearch(e: React.FormEvent) {
    e.preventDefault(); // ページの再読み込みを止める
    runSearch(budget, age);
  }

  return (
    <section>
      {/* 検索フォーム（トップ画面と同じ見た目のクラスを使う） */}
      <form className="form" style={{ marginTop: 0 }} onSubmit={onSearch}>
        <label className="field sel">
          予算
          <select value={budget} onChange={(e) => setBudget(e.target.value)}>
            {BUDGETS.map((b) => (
              <option key={b.value} value={b.value}>{b.label}</option>
            ))}
          </select>
        </label>
        <label className="field sel">
          相手の年代
          <select value={age} onChange={(e) => setAge(e.target.value)}>
            <option value="">指定なし</option>
            {AGES.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </label>
        <button type="submit">検索</button>
      </form>

      {error && <p className="summary">{error}</p>}
      {!error && result === null && <p className="summary">検索中…</p>}

      {result && (
        <div style={{ marginTop: "20px" }}>
          {/* 年代で0件だったので、年代を外して取り直したとき */}
          {result.relaxed && (
            <p style={{ color: "var(--accent)", fontWeight: "bold", fontSize: "14px" }}>
              年代に合う商品がないため、年代を指定せずに表示しています
            </p>
          )}

          <p className="summary">
            送別向けの商品 {result.totalCandidates} 件のうち、おすすめ順に上位 {result.results.length} 件
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
        </div>
      )}
    </section>
  );
}
