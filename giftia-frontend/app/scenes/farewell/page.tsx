"use client";

import { useState } from "react";
import Link from "next/link";
import Header from "@/app/components/Header";
import { useRouter } from "next/navigation";
import { ApiError, createVote } from "@/lib/votesApi";
import SearchTab from "./SearchTab";

type Tab = "article" | "search";

// 特集記事に載せる商品（商品部が選んだ固定リスト。仮データ）
type FeaturedItem = {
  id: string;
  name: string;
  price: number;
  rating: number | null;
  reviewCount: number;
  comment: string; // 商品部のコメント
};

const featuredItems: FeaturedItem[] = [
  { id: "G0027", name: "Cacao no Mori ショコラアソート 12粒入", price: 2300, rating: 4.7, reviewCount: 31, comment: "評価の高いショコラのアソート。甘いものが好きな方にも、そうでない方にも選びやすい定番です。" },
  { id: "G0007", name: "喫茶と焙煎 さざなみ ドリップバッグ 20袋アソート", price: 3180, rating: 4.0, reviewCount: 39, comment: "20袋入りなので、職場のみなさんで分けて飲めます。レビュー件数も多く安心です。" },
  { id: "G0019", name: "せんべい 大川屋 おかきの詰め合わせ「梅」", price: 3600, rating: 4.5, reviewCount: 11, comment: "洋菓子が苦手な方にも渡せる和のお菓子。世代を問わず喜ばれます。" },
  { id: "G0001", name: "Lino 国産タオルギフトセット", price: 4400, rating: 4.4, reviewCount: 13, comment: "国産タオルのセット。毎日使えて、好みが分かれにくい実用品です。" },
  { id: "G0026", name: "織物工場 いまばり舎 今治ハンドタオル 2枚セット", price: 1280, rating: 4.4, reviewCount: 10, comment: "予算を抑えたいときに。今治タオルを気軽に贈れます。" },
  { id: "G0034", name: "Petal Room Mio お花とお菓子のセット（焼き菓子）", price: 3700, rating: 4.4, reviewCount: 12, comment: "お花とお菓子がセットになった、華やかな送別向けのギフトです。" },
  { id: "G0076", name: "ショコラ工房 ユキ ショコラアソート 16粒入", price: 3580, rating: 4.4, reviewCount: 13, comment: "16粒入りで、部署のみんなに配りやすいボリュームです。" },
  { id: "G0139", name: "焼菓子舗 こむぎの丘 焼き菓子ギフト「ひととき」20個入", price: 3800, rating: 4.2, reviewCount: 9, comment: "20個入りの焼き菓子。人数が多い職場にも対応できます。" },
];

export default function FarewellPage() {
  // 今、どちらのタブを開いているか（最初は特集記事）
  const [tab, setTab] = useState<Tab>("article");
    // 投票の候補に入れた商品のID／作成中かどうか／エラーのメッセージ
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const router = useRouter();

  // チェックを入れる・外す
  const toggle = (productId: string) => {
    setSelectedIds((previous) =>
      previous.includes(productId)
        ? previous.filter((id) => id !== productId)
        : [...previous, productId],
    );
  };

  // 2〜5個のときだけ、投票ページを作れる
  const canCreate = selectedIds.length >= 2 && selectedIds.length <= 5;

  // 投票ページを作って、そのページに移る
  const create = async () => {
    setCreating(true);
    setCreateError("");
    try {
      // 画面に出ている順（順位の順）にそろえて送る
      const created = await createVote(selectedIds);
      router.push(created.url_path);
    } catch (error) {
      setCreateError(
        error instanceof ApiError
          ? error.message
          : "投票ページを作れませんでした。通信を確認してください。",
      );
      setCreating(false);
    }
  };

  return (
    <main style={styles.page}>
      {/* ヘッダー（共通部品。ロゴ → トップ、マイページ → /mypage） */}
      <Header />

      <div style={styles.container}>
        <p style={styles.breadcrumb}>
          <Link href="/">トップ</Link> ＞ 送別
        </p>
        <h1 style={styles.heading}>送別ギフト</h1>

        {/* タブ */}
        <div role="tablist" style={styles.tabs}>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "article"}
            onClick={() => setTab("article")}
            style={tab === "article" ? styles.tabActive : styles.tab}
          >
            特集記事
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "search"}
            onClick={() => setTab("search")}
            style={tab === "search" ? styles.tabActive : styles.tab}
          >
            検索画面
          </button>
        </div>

        {/* 特集記事タブ */}
        {tab === "article" && (
          <section>
            <div style={styles.guideCard}>
              <p style={styles.draftNote}>※仮の文章です（編集チームのレビュー前）</p>
              <h2 style={styles.guideTitle}>送別ギフト、何にする？ Giftiaのおすすめ10選！</h2>
              <p>
                異動や退職のプレゼントって、相手の好みが分からなくて悩みますよね。そんなときのために、商品部のメンバーが「これなら外さないはず」と思う商品を選びました。連名で贈る場合も、ひとりで贈る場合も、ぜひ参考にしてください。
              </p>

              <h3 style={styles.guideSubTitle}>選ぶときの目安は、この7つ</h3>
              <p>
                社員が選ぶときには、こんなところを見ています。自分で選ぶときのチェックにも使ってみてください⭐️
              </p>
              <ul style={styles.guideList}>
                <li>常温保存：冷蔵庫がいっぱいでも、そのまま置いておけます。</li>
                <li>日持ち（14日以上）：バタバタしている時期でも、急いで食べなくて大丈夫です。</li>
                <li>職場での注文実績：職場への贈り物として、よく選ばれています。</li>
                <li>実用性：もらったあとに「これ、どうしよう…」となりにくいです。</li>
                <li>仕事で使える：デスクや外出先で、さっそく使えます。</li>
                <li>香りが強くない：好みが分かれにくく、まわりの人も気になりません。</li>
                <li>消費財：食べたり使ったりして、なくなるので、置き場所にも困りません。</li>
              </ul>

              <h3 style={styles.guideSubTitle}>これは避けたほうがいいかも・・・</h3>
              <ul style={styles.guideList}>
                <li>香りの強いもの：好き嫌いがはっきり分かれます。</li>
                <li>要冷蔵・生もの：渡した日に食べられないと、困らせてしまうかも。</li>
                <li>大きくてかさばるもの：持ち帰るのが大変です。</li>
                <li>高すぎるもの：相手が気をつかって、お返しを考えさせてしまいます。</li>
              </ul>

              <h3 style={styles.guideSubTitle}>渡すときのちょっとしたコツ</h3>
              <ul style={styles.guideList}>
                <li>タイミング：最終出勤日の前日か当日がおすすめです。</li>
                <li>予算：連名なら、1人500〜1,000円くらいが目安です。</li>
                <li>渡し方：みんなで一言添えて渡すと、気持ちがぐっと伝わります。</li>
                <li>表書き：目上の方には「餞別」ではなく、「御礼」や「感謝」を使うと安心です。</li>
                <li>メッセージ：寄せ書きやカードを添えると、品物以上に喜ばれます。</li>
              </ul>

              <h3 style={styles.guideSubTitle}>みんなで決めたいときは</h3>
              <ol style={styles.guideList}>
                <li>下のおすすめから、気になる商品を2〜5個選びます。</li>
                <li>「投票ページを作る」を押します。</li>
                <li>できたページのURLを、一緒に贈る仲間に送ります。</li>
                <li>みんなの「いいね」を見て、贈るものを決めましょう。</li>
              </ol>
            </div>

                        <h2 style={styles.sectionTitle}>おすすめ商品</h2>

            <div style={styles.productList}>
                {featuredItems.map((item, index) => (
                    <article key={item.id} style={styles.productCard}>
                    <div style={styles.rank}>{index + 1}</div>

                    <div style={styles.imageBox} role="img" aria-label="商品画像の枠（仮）" />

                    <div style={styles.productBody}>
                        <h3 style={styles.productName}>{item.name}</h3>

                        <p style={styles.productMeta}>
                        <strong>{item.price.toLocaleString()}円</strong>
                        　{item.rating !== null ? `評価 ${item.rating.toFixed(1)}（${item.reviewCount}件）` : "評価なし"}
                        </p>

                        <p style={styles.reason}>{item.comment}</p>

                        <label style={styles.checkLabel}>
                        <input
                            type="checkbox"
                            checked={selectedIds.includes(item.id)}
                            disabled={!selectedIds.includes(item.id) && selectedIds.length >= 5}
                            onChange={() => toggle(item.id)}
                            style={styles.checkbox}
                        />
                        投票の候補に入れる
                        </label>
                    </div>
                    </article>
                ))}
                </div>
          </section>
        )}

        {/* 検索画面タブ */}
        {tab === "search" && (
          <SearchTab
            selectedIds={selectedIds}
            onToggle={toggle}
            isFull={selectedIds.length >= 5}
          />
        )}

        {/* 画面の下に付いてくる、選んだ数と「投票ページを作る」ボタン */}
        <div style={styles.selectionBar}>
            <span>
            <strong>{selectedIds.length}件</strong>選択中（2〜5件で作れます）
            </span>

            <button
            type="button"
            onClick={create}
            disabled={!canCreate || creating}
            style={canCreate && !creating ? styles.createButton : styles.createButtonDisabled}
            >
            {creating ? "作成中…" : "投票ページを作る"}
            </button>

            {createError && <span style={styles.barError}>{createError}</span>}
        </div>
      </div>
    </main>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  page: {
    minHeight: "100vh",
    backgroundColor: "var(--bg)",
    color: "var(--ink)",
  },
  container: {
    maxWidth: "1100px",
    margin: "0 auto",
    padding: "32px 20px",
  },
  breadcrumb: {
    color: "var(--sub)",
    fontSize: "14px",
    margin: "0",
  },
  heading: {
    fontSize: "30px",
    margin: "4px 0 16px",
  },
  tabs: {
    display: "flex",
    gap: "8px",
    borderBottom: "2px solid var(--line)",
    marginBottom: "24px",
  },
  tab: {
    minHeight: "44px",
    padding: "0 20px",
    border: "1px solid transparent",
    borderRadius: 0,
    backgroundColor: "transparent",
    color: "var(--ink)",
    fontSize: "15px",
    cursor: "pointer",
  },
  tabActive: {
    minHeight: "44px",
    padding: "0 20px",
    border: "1px solid var(--accent)",
    borderRadius: 0,
    backgroundColor: "var(--accent)",
    color: "#FFFFFF",
    fontSize: "15px",
    fontWeight: "bold",
    cursor: "pointer",
  },
  guideCard: {
    padding: "20px",
    marginBottom: "24px",
    backgroundColor: "var(--surface)",
    border: "1px solid var(--line)",
    borderRadius: "var(--radius-card)",
    lineHeight: 1.7,
  },
  draftNote: {
    color: "var(--sub)",
    fontSize: "13px",
    margin: "0 0 4px",
  },
  guideTitle: {
    fontSize: "22px",
    margin: "0 0 8px",
  },
  guideSubTitle: {
    fontSize: "17px",
    margin: "16px 0 8px",
  },
  guideList: {
    margin: "0",
    paddingLeft: "20px",
    color: "var(--sub)",
  },
  meta: {
    color: "var(--sub)",
    fontSize: "14px",
  },

    sectionTitle: {
    fontSize: "20px",
    margin: "0 0 12px",
  },
  productList: {
    display: "grid",
    gap: "12px",
  },
  productCard: {
    display: "flex",
    flexWrap: "wrap",
    gap: "16px",
    alignItems: "flex-start",
    padding: "16px",
    backgroundColor: "var(--surface)",
    border: "1px solid var(--line)",
    borderRadius: "var(--radius-card)",
  },
  rank: {
    width: "56px",
    fontSize: "26px",
    fontWeight: "bold",
    color: "var(--accent)",
  },
  imageBox: {
    width: "112px",
    height: "112px",
    backgroundColor: "var(--tint)",
    borderRadius: "var(--radius-control)",
  },
  productBody: {
    flex: "1",
    minWidth: "220px",
  },
  productName: {
    fontSize: "17px",
    margin: "0",
  },
  brand: {
    color: "var(--sub)",
    fontSize: "14px",
    fontWeight: "normal",
  },
  productMeta: {
    margin: "4px 0 8px",
  },
  chip: {
    display: "inline-block",
    padding: "2px 10px",
    margin: "2px 4px 2px 0",
    borderRadius: "var(--radius-control)",
    backgroundColor: "var(--tint)",
    color: "var(--accent-dark)",
    fontSize: "13px",
  },
  reason: {
    margin: "8px 0 0",
    fontSize: "14px",
    lineHeight: 1.7,
  },
    checkLabel: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    minHeight: "44px",
    marginTop: "4px",
    cursor: "pointer",
  },
  checkbox: {
    width: "20px",
    height: "20px",
  },
  selectionBar: {
    position: "sticky",
    bottom: 0,
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    marginTop: "24px",
    padding: "12px 20px",
    backgroundColor: "var(--surface)",
    border: "1px solid var(--accent)",
    borderRadius: "var(--radius-card)",
  },
  createButton: {
    minHeight: "44px",
    padding: "0 24px",
    border: "none",
    borderRadius: "var(--radius-control)",
    backgroundColor: "var(--accent)",
    color: "#FFFFFF",
    fontSize: "15px",
    fontWeight: "bold",
    cursor: "pointer",
  },
  createButtonDisabled: {
    minHeight: "44px",
    padding: "0 24px",
    border: "none",
    borderRadius: "var(--radius-control)",
    backgroundColor: "var(--line)",
    color: "var(--sub)",
    fontSize: "15px",
    fontWeight: "bold",
    cursor: "not-allowed",
  },
  barError: {
    width: "100%",
    color: "var(--accent)",
    fontWeight: "bold",
    fontSize: "14px",
  },
};