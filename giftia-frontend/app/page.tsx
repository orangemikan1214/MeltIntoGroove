// app/page.tsx — Giftia 検索画面（2週目・穴埋め版）
// 【穴7】【穴8】を、対応表と公式ドキュメントを頼りに自分で埋める。
// 答えは 配布コード/答え合わせ/frontend/page.tsx（自分で埋めてから見る）。
// 1週目との違い：①searchGifts が FastAPI を呼ぶ（async/await）②入力した条件を渡す ③つながらないときの表示
"use client"; // ← ブラウザで動く合図。useState や onClick を使う画面に必要

import { useState } from "react";
import ResultCard from "./ResultCard";
import { searchGifts, type Gift } from "@/lib/api";

export default function Home() {
  // ① 状態（変化するデータ）を覚える箱
  const [mode, setMode] = useState<"standard" | "business">("standard"); // どのタブか
  const [keyword, setKeyword] = useState("");                             // 入力した言葉
  const [category, setCategory] = useState("");                           // 選んだカテゴリー
  const [sceneTag, setSceneTag] = useState("");                           // 選んだシーンタグ
  const [indivWrap, setIndivWrap] = useState(false); // 個包装だけ（取引先へのお礼）
  const [priceBand, setPriceBand] = useState("");                         // 価格帯（取引先へのお礼）
  const [results, setResults] = useState<Gift[] | null>(null);            // 検索結果
  const [error, setError] = useState("");                                 // つながらないときの文言

  // ② 検索ボタンの処理（API に聞くので、結果が返るまで待つ＝async/await）
  async function onSearch(e: React.FormEvent) {
    e.preventDefault(); // ページの再読み込みを止める
    setError("");
    // いま開いているタブの条件だけを送る（もう一方のタブの入力は送らない）
    const condition = mode === "standard"
      ? { keyword, category, sceneTag, indivWrap: false, priceBand: "" }
      : { keyword: "", category: "", sceneTag: "", indivWrap, priceBand };
    try {
      setResults(await searchGifts(condition));
    } catch (err) {
      setResults(null);
      setError(`APIにつながりません：${(err as Error).message}`); // 原因はブラウザの Console に出る
    }
  }

  // ③ 画面
  return (
    <main className="page">
      <header className="header"><h1>Giftia</h1></header>

      {/* タブ：state(mode)＋条件で出し分ける */}
      <nav className="modes">
        <button className={mode === "standard" ? "on" : ""} onClick={() => { setMode("standard"); setResults(null); }}>いまの検索</button>
        <button className={mode === "business" ? "on" : ""} onClick={() => { setMode("business"); setResults(null); }}>取引先へのお礼</button>
      </nav>

      <form className="form" onSubmit={onSearch}>
        {mode === "standard" ? (
          <>
            <input className="q" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="キーワード（例：送別 お菓子）" />
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">すべてのカテゴリー</option>
              <option value="コスメ">コスメ</option>
              <option value="食品">食品</option>
              <option value="生活雑貨">生活雑貨</option>
            </select>
            <select value={sceneTag} onChange={(e) => setSceneTag(e.target.value)}>
              <option value="">すべてのシーン</option>
              <option value="誕生日">誕生日</option>
              <option value="送別">送別</option>
              <option value="お礼">お礼</option>
              <option value="母の日">母の日</option>
              <option value="お歳暮">お歳暮</option>
              <option value="お中元">お中元</option>
              <option value="結婚祝い">結婚祝い</option>
              <option value="父の日">父の日</option>
              <option value="出産祝い">出産祝い</option>
            </select>
          </>
        ) : (
          <>
            <label className="chk"><input type="checkbox" checked={indivWrap} onChange={(e) => setIndivWrap(e.target.checked)} /> 個包装</label>
            <select value={priceBand} onChange={(e) => setPriceBand(e.target.value)}>
              <option value="">すべての価格帯</option>
              <option value="3000">3,000〜5,000円</option>
              <option value="5000">5,000〜10,000円</option>
            </select>
          </>
        )}
        <button type="submit">検索</button>
      </form>

      {error && <p className="summary">{error}</p>}

      {/* 結果：同じ ResultCard を map で並べる（使い回し） */}
      {results && (
        <section>
          <p className="summary">上位 {results.length} 件</p>
          <div className="grid">
            {results.map((g, i) => <ResultCard key={g.id} gift={g} rank={i + 1} />)}
          </div>
        </section>
      )}
    </main>
  );
}
