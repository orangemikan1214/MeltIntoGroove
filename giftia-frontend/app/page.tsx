// app/page.tsx — Giftia 検索画面（2週目・穴埋め版）
// 【穴7】【穴8】を、対応表と公式ドキュメントを頼りに自分で埋める。
// 答えは 配布コード/答え合わせ/frontend/page.tsx（自分で埋めてから見る）。
// 1週目との違い：①searchGifts が FastAPI を呼ぶ（async/await）②入力した条件を渡す ③つながらないときの表示
"use client"; // ← ブラウザで動く合図。useState や onClick を使う画面に必要

import { useState } from "react";
import ResultCard from "./ResultCard";
import { searchGifts, type Gift } from "@/lib/api";
import Header from "./components/Header";
import SceneCards from "./components/SceneCards";

export default function Home() {
  // ① 状態（変化するデータ）を覚える箱
  const [mode] = useState<"standard" | "business">("standard"); // どのタブか（取引先へのお礼タブは画面から外したので、いまは常に standard）
  const [keyword, setKeyword] = useState("");                             // 入力した言葉
  const [category, setCategory] = useState("");                           // 選んだカテゴリー
  const [sceneTag, setSceneTag] = useState("");                           // 選んだシーン（※lib/api.ts はまだ API に送っていないので、いまは絞り込みに使われない）
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
    <>
      {/* 共通ヘッダー（ロゴ → トップ、マイページ → /mypage） */}
      <Header />

      {/* 上の帯：見出しと検索フォーム */}
      <section className="hero">
        <div className="heroInner">
          <p className="heroLabel">ギフト専門ストア</p>
          <h1 className="heroTitle">
            贈る相手を思い浮かべて、<br />シーンから選ぼう。
          </h1>

          {/* 検索フォーム：「検索」ボタン → onSearch → lib/api.ts の searchGifts → FastAPI の /api/search */}
          <form className="form" onSubmit={onSearch}>
            {mode === "standard" ? (
              <>
                {/* キーワード → 検索条件 keyword（API には q として送る） */}
                <label className="field q">
                  キーワード
                  <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="キーワード（例：送別 お菓子）" />
                </label>
                {/* カテゴリー → 検索条件 category */}
                <label className="field sel">
                  カテゴリー
                  <select value={category} onChange={(e) => setCategory(e.target.value)}>
                    <option value="">すべてのカテゴリー</option>
                    <option value="コスメ">コスメ</option>
                    <option value="食品">食品</option>
                    <option value="生活雑貨">生活雑貨</option>
                  </select>
                </label>
                 {/* シーン → 検索条件 sceneTag（※lib/api.ts はまだ API に送っていないので、いまは絞り込みに使われない） */}
                <label className="field sel">
                  シーン
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
                </label>
              </>
            ) : (
              <>
                {/* 取引先へのお礼の検索（タブを画面から外したので、いまは表示されない。処理は残してある） */}
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
        </div>
      </section>

      <main className="page">
        {/* APIにつながらないときの文言（onSearch の catch で入る） */}
        {error && <p className="summary">{error}</p>}

        {/* 結果：同じ ResultCard を map で並べる（使い回し） */}
        {results && (
          <section className="results">
            <p className="summary">上位 {results.length} 件</p>
            <div className="grid">
              {results.map((g, i) => <ResultCard key={g.id} gift={g} rank={i + 1} />)}
            </div>
          </section>
        )}

        {/* シーンカード（送別カード → /scenes/farewell） */}
        <SceneCards />
      </main>
    </>
  );
}
