// lib/api.ts — 2週目：searchGifts() の中身を「FastAPI に聞く」に差し替える（穴埋め版）
// 【穴5】【穴6】を、対応表と公式ドキュメントを頼りに自分で埋める。
// 1週目の lib/sampleGifts.ts は、このファイルに置き換える（ダミーは使わない）。
// 答えは 配布コード/答え合わせ/frontend/api.ts（自分で埋めてから見る）。

// 画面が使う商品の形。1週目と同じ（画面・ResultCard は変えない）
export type Gift = {
  id: string;          // 商品ID（例 G0001）
  category: string;    // カテゴリ
  brand: string;       // ブランド・店名
  name: string;        // 商品名
  price: number;       // 価格（円）
  rating: number;      // レビューの平均
  reviewCount: number; // レビュー件数
  description: string; // 商品説明
};

// 画面から渡す検索条件（2つのタブの分をまとめて持つ）
export type SearchCondition = {
  keyword: string;    // いまの検索：キーワード
  category: string;   // いまの検索：カテゴリー（空ならすべて）
  indivWrap: boolean; // 取引先へのお礼：個包装だけ
  priceBand: string;  // 取引先へのお礼："" | "3000" | "5000"
};

// API の場所。NEXT_PUBLIC_ の値はブラウザに配られる＝秘密は置かない（.env.local に書く）
const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// 入力した条件をサーバー（FastAPI）に送り、結果（Gift の配列）をもらう
export async function searchGifts(c: SearchCondition): Promise<Gift[]> {
  // ① 条件を URL のクエリ（?q=...&category=...）に組み立てる。空の条件は送らない
  const params = new URLSearchParams();
  if (c.keyword) params.set("q", c.keyword);
  if (c.category) params.set("category", c.category);
  if (c.indivWrap) params.set("indiv_wrap", "true");
  if (c.priceBand === "3000") { params.set("price_min", "3000"); params.set("price_max", "4999"); } // 3,000以上 5,000未満
  if (c.priceBand === "5000") { params.set("price_min", "5000"); params.set("price_max", "9999"); } // 5,000以上 10,000未満

  // ② fetch で API を呼ぶ（通信が終わるまで待つ＝await）
  const res = await fetch(`${API}/api/search?${params.toString()}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  // ③ 返ってきた JSON を読む。{ total, results } の results が Gift の配列
  const data = await res.json();
  return data.results;
}

// ===== シーン別のおすすめ（点数ランキング）API：送別ギフトの検索画面が使う =====

// 推薦理由（点数の材料。サーバーが組み立てて返す）
export type Reasons = {
  conditions: string[];      // 満たしている安心条件の表示名（例：常温保存）
  sales_rank: number | null; // シーン向けの商品の中での販売数の順位
  rating: number;            // 評価
  review_count: number;      // レビュー件数
  text: string;              // 推薦理由の文章
};

// おすすめ1件：Gift に、順位・点数・推薦理由が付く
export type Recommendation = Gift & {
  rank: number;     // おすすめ順の順位
  score: number;    // 点数
  reasons: Reasons; // 推薦理由
};

// APIの返事
export type RecommendationResult = {
  scene: string;
  totalCandidates: number; // 絞り込みに合った商品の数
  relaxed: boolean;        // true：年代で0件だったので、年代を外して取り直した
  results: Recommendation[];
};

// 絞り込みの条件（空・未指定は「指定なし」）
export type RecommendationCondition = {
  ageGroup?: string; // 10代／20代／30代／40代／50代／60代以上
  priceMin?: number; // 予算の下限（以上）
  priceMax?: number; // 予算の上限（以下）
  limit?: number;    // 返す件数
};

// シーン別のおすすめを、点数の高い順にもらう（sceneCode は "farewell" のみ対応）
export async function fetchRecommendations(sceneCode: string, c: RecommendationCondition): Promise<RecommendationResult> {
  const params = new URLSearchParams();
  if (c.ageGroup) params.set("age_group", c.ageGroup);
  if (c.priceMin !== undefined) params.set("price_min", String(c.priceMin));
  if (c.priceMax !== undefined) params.set("price_max", String(c.priceMax));
  if (c.limit !== undefined) params.set("limit", String(c.limit));

  const res = await fetch(`${API}/api/scenes/${encodeURIComponent(sceneCode)}/recommendations?${params.toString()}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  // サーバーの項目名（total_candidates）を、画面側の書き方（totalCandidates）に直す
  const data = await res.json();
  return {
    scene: data.scene,
    totalCandidates: data.total_candidates,
    relaxed: data.relaxed,
    results: data.results,
  };
}
