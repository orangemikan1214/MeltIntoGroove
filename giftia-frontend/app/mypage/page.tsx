"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Header from "@/app/components/Header";
import { fetchMyVotes, formatDate, type VoteSummary } from "@/lib/votesApi";

export default function MyPage() {
  // APIから取った、投票ページの一覧
  const [votes, setVotes] = useState<VoteSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copyMessage, setCopyMessage] = useState("");

  // 画面を開いたとき、自分が作った投票ページの一覧を、APIから取る
  useEffect(() => {
    fetchMyVotes()
      .then((result) => setVotes(result.votes))
      .catch(() => setError("投票ページの一覧を読み込めませんでした。"))
      .finally(() => setLoading(false));
  }, []);

  // 投票ページのURLをコピーする
  const copyUrl = async (urlPath: string) => {
    const url = `${window.location.origin}${urlPath}`;

    try {
      await navigator.clipboard.writeText(url);
      setCopyMessage("URLをコピーしました！");
    } catch {
      setCopyMessage("コピーできませんでした。");
    }

    // 2秒後にメッセージを消す
    setTimeout(() => {
      setCopyMessage("");
    }, 2000);
  };

  // 期限切れかどうかは、サーバーが返す expired を使う
  const activeVotes = votes.filter((vote) => !vote.expired);
  const expiredVotes = votes.filter((vote) => vote.expired);

  // 表示用のタイトル（「送別ギフト投票 商品A・商品B」）
  const titleOf = (vote: VoteSummary) =>
    `送別ギフト投票 ${vote.items.map((item) => item.product_name ?? item.product_id).join("・")}`;

  return (
    <main style={styles.page}>
      {/* ヘッダー（共通部品。ロゴ → トップ、マイページ → /mypage） */}
      <Header current="mypage" />

      {/* メインコンテンツ */}
      <div style={styles.container}>
        <h1 style={styles.heading}>マイページ</h1>

        <p style={styles.description}>ログイン中のアカウントです（検証用の仮画面）。</p>

        {copyMessage && <p style={styles.copyMessage}>{copyMessage}</p>}
        {error && <p style={styles.copyMessage}>{error}</p>}
        {loading && <p style={styles.meta}>読み込み中…</p>}

        {/* 有効な投票ページ */}
        <section>
          <h2 style={styles.subHeading}>作成した投票ページ</h2>

          <div style={styles.voteList}>
            {!loading && !error && activeVotes.length === 0 && (
              <p style={styles.meta}>
                まだ投票ページがありません。
                <Link href="/">トップページ</Link>から、送別ギフトの投票ページを作れます。
              </p>
            )}

            {activeVotes.map((vote) => (
              <div key={vote.token} style={styles.voteCard}>
                <div style={styles.voteInfo}>
                  <ul style={styles.productNames}>
                    {vote.items.map((item) => (
                      <li key={item.product_name ?? item.product_id}>
                        {item.product_name ?? item.product_id}
                      </li>
                    ))}
                  </ul>

                  <p style={styles.meta}>
                    作成日：{formatDate(vote.created_at)}
                    <br />
                    有効期限：{formatDate(vote.expires_at)}
                  </p>

                  <p style={styles.meta}>
                    {vote.voter_count > 0
                      ? `${vote.voter_count}人が回答`
                      : "0人が回答（まだ投票されていません）"}
                  </p>
                </div>

                <div style={styles.actions}>
                  <Link href={vote.url_path} style={styles.primaryButton}>
                    結果を見る
                  </Link>

                  <button
                    type="button"
                    onClick={() => copyUrl(vote.url_path)}
                    style={styles.secondaryButton}
                  >
                    URLをコピー
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 期限切れの投票ページ */}
        <section style={styles.expiredSection}>
          <h2 style={styles.subHeading}>期限切れの投票ページ</h2>

          <div style={styles.voteList}>
            {expiredVotes.length > 0 ? (
              expiredVotes.map((vote) => (
                <div key={vote.token} style={styles.expiredCard}>
                  <div>
                    <ul style={styles.productNames}>
                      {vote.items.map((item) => (
                        <li key={item.product_name ?? item.product_id}>
                          {item.product_name ?? item.product_id}
                        </li>
                      ))}
                    </ul>

                    <p style={styles.meta}>
                      作成日：{formatDate(vote.created_at)}
                      <br />
                      有効期限：{formatDate(vote.expires_at)}
                      <br />
                      {vote.voter_count}人が回答
                    </p>
                  </div>

                  <Link href={vote.url_path} style={styles.secondaryButton}>
                    結果を見る
                  </Link>
                </div>
              ))
            ) : (
              !loading && !error && <p style={styles.meta}>期限切れの投票ページはありません。</p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

// CSS（画面の見た目）
const styles: { [key: string]: React.CSSProperties } = {
  page: {
    minHeight: "100vh",
    backgroundColor: "#FAF8F5",
    color: "#1F2328",
    fontFamily: '"Noto Sans JP", sans-serif',
  },
  container: {
    maxWidth: "1000px",
    margin: "0 auto",
    padding: "40px 20px",
  },
  heading: {
    fontSize: "30px",
    margin: "0 0 4px",
  },
  description: {
    color: "#5B6168",
    marginBottom: "32px",
  },
  subHeading: {
    fontSize: "20px",
    marginBottom: "12px",
  },
  voteList: {
    display: "grid",
    gap: "12px",
  },
  voteCard: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "16px",
    padding: "20px",
    backgroundColor: "#FFFFFF",
    border: "1px solid #E3DED6",
    borderRadius: "12px",
  },
  voteInfo: {
    flex: "1",
    minWidth: "220px",
  },
  voteTitle: {
    fontSize: "16px",
  },
  meta: {
    color: "#5B6168",
    fontSize: "14px",
    lineHeight: "1.8",
    margin: "8px 0 0",
  },
  actions: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
  },
  primaryButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "10px 18px",
    borderRadius: "8px",
    backgroundColor: "#BE185D",
    color: "#FFFFFF",
    textDecoration: "none",
    border: "none",
    fontSize: "14px",
    fontWeight: "bold",
  },
  secondaryButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "10px 18px",
    borderRadius: "8px",
    backgroundColor: "#FFFFFF",
    color: "#1F2328",
    textDecoration: "none",
    border: "1px solid #B9B2A7",
    fontSize: "14px",
    cursor: "pointer",
  },
  expiredSection: {
    marginTop: "36px",
  },
  expiredCard: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "16px",
    padding: "20px",
    backgroundColor: "#F1EEE9",
    color: "#4A5057",
    borderRadius: "12px",
  },
  copyMessage: {
    color: "#BE185D",
    fontWeight: "bold",
    marginBottom: "16px",
  },
  productNames: {
    margin: 0,
    paddingLeft: "20px",
    fontSize: "16px",
    fontWeight: "bold",
    lineHeight: 1.7,
  },
};
