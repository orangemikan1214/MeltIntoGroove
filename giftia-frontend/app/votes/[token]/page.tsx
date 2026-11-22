"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import Header from "@/app/components/Header";
import { ApiError, fetchVote, formatDate, getVoterKey, submitVoteResponse, type VoteAnswerValue, type VoteDetail } from "@/lib/votesApi";

type LoadState = "loading" | "ready" | "notFound" | "error";

export default function VotePage() {
  // URLからtokenを取得する
  const params = useParams();
  const token = params.token as string;

  // APIから取った投票ページのデータ
  const [vote, setVote] = useState<VoteDetail | null>(null);
  const [status, setStatus] = useState<LoadState>("loading");

  // ニックネーム／商品ごとの自分の回答（送信は Step 11 でつなぐ）
  const [nickname, setNickname] = useState("");
  const [myAnswers, setMyAnswers] = useState<Record<string, VoteAnswerValue>>({});

  // メッセージ表示
  const [message, setMessage] = useState("");

    // 送信中かどうか（二重に押されないようにする）
  const [submitting, setSubmitting] = useState(false);
  
  //自分の回答を修正中かどうか
  const [editing, setEditing] = useState(false);

  // 共有URL（window はブラウザでしか使えないので、useEffect の中で取る）
  const [shareUrl, setShareUrl] = useState("");
  useEffect(() => {
    setShareUrl(window.location.href);
  }, []);

  // 投票ページのデータを、APIから取る
  useEffect(() => {
    const load = async () => {
      try {
        setVote(await fetchVote(token, getVoterKey()));
        setStatus("ready");
      } catch (error) {
        setStatus(error instanceof ApiError && error.status === 404 ? "notFound" : "error");
      }
    };
    load();
  }, [token]);

  // 読み込み中
  if (status === "loading") {
    return (
      <main style={styles.page}>
        <div style={styles.container}>読み込み中…</div>
      </main>
    );
  }

  // 存在しないURLの場合
  if (status === "notFound") {
    return (
      <main style={styles.page}>
        <div style={styles.container}>
          <h1>投票ページが見つかりません</h1>
          <p>この投票ページは存在しないか、URLが間違っています。</p>
          <Link href="/" style={styles.primaryButton}>
            トップページへ戻る
          </Link>
        </div>
      </main>
    );
  }

  // 通信などの失敗
  if (status === "error" || !vote) {
    return (
      <main style={styles.page}>
        <div style={styles.container}>
          <h1>読み込めませんでした</h1>
          <p>時間をおいて、もう一度お試しください。</p>
          <button type="button" onClick={() => window.location.reload()} style={styles.secondaryButton}>
            再読み込み
          </button>
        </div>
      </main>
    );
  }

  // 期限切れかどうかは、サーバーが返す expired を使う
  const isExpired = vote.expired;

  // 賛成・反対を選択する
  const selectAnswer = (productId: string, answer: VoteAnswerValue) => {
    setMyAnswers((previous) => ({
      ...previous,
      [productId]: answer,
    }));
  };

    // 自分の回答を、入力欄に戻して修正を始める
  const startEdit = (voter: { nickname: string; answers: Record<string, VoteAnswerValue> }) => {
    setNickname(voter.nickname);
    setMyAnswers(voter.answers);
    setMessage("");
    setEditing(true);
  };

  // 修正をやめる
  const cancelEdit = () => {
    setEditing(false);
    setNickname("");
    setMyAnswers({});
  };

  // 自分の回答があるか／入力欄を出すか
  const hasAnswered = vote.voters.some((voter) => voter.is_me);
  const showAnswerRow = !isExpired && (!hasAnswered || editing);

  // 投票を送信する
  const submitVote = async () => {
    // すべての商品に回答しているか確認
    const allAnswered = vote.items.every((item) => myAnswers[item.product_id]);
    if (!allAnswered) {
      setMessage("すべての商品に賛成・反対を選択してください。");
      return;
    }

    setSubmitting(true);
    try {
      const updated = await submitVoteResponse(token, {
        voterKey: getVoterKey(),
        nickname: nickname.trim(),
        answers: myAnswers,
      });
      setVote(updated); // 表を、最新の結果に入れ替える
      setEditing(false);
      setMyAnswers({});
      setNickname("");
      setMessage("回答を受け付けました！");
    } catch (error) {
      if (error instanceof ApiError && error.status === 410) {
        setMessage("この投票ページは有効期限が切れました。");
        setVote({ ...vote, expired: true });
      } else if (error instanceof ApiError) {
        setMessage(`送信できませんでした：${error.message}`);
      } else {
        setMessage("送信できませんでした。通信を確認してください。");
      }
    } finally {
      setSubmitting(false);
    }
  };

  // URLをコピーする
  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setMessage("共有URLをコピーしました！");
    } catch {
      setMessage("URLをコピーできませんでした。");
    }
  };

    return (
    <main style={styles.page}>
      {/* ヘッダー（共通部品。ロゴ → トップ、マイページ → /mypage） */}
      <Header />

      <div style={styles.container}>
        {/* タイトル */}
        <h1 style={styles.heading}>どれがいいですか？</h1>

        <p style={styles.description}>
          会員登録は不要です。実名や個人情報は入れないでください。
        </p>

        {/* 共有URL */}
        <div style={styles.urlCard}>
          <span style={styles.urlText}>{shareUrl}</span>

          <span style={styles.expiry}>有効期限：{formatDate(vote.expires_at)}</span>

          <button type="button" onClick={copyUrl} style={styles.secondaryButton}>
            URLをコピー
          </button>
        </div>

        {/* メッセージ */}
        {message && <p style={styles.message}>{message}</p>}

        {/* 期限切れの案内 */}
        {isExpired && (
          <div style={styles.expiredMessage}>
            この投票ページは有効期限が切れています。
            <br />
            現在は結果の閲覧のみ可能です。
          </div>
        )}

        {/* 投票テーブル */}
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.headerCell}>投票した人</th>

                {vote.items.map((item) => (
                  <th key={item.product_id} style={styles.headerCell}>
                    {item.product_name ?? item.product_id}
                    <div style={styles.productDescription}>
                      {item.price !== null && `${item.price.toLocaleString()}円`}
                      {item.rating !== null && `・評価 ${item.rating}（${item.review_count ?? 0}件）`}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {/* 既存の投票者 */}
              {vote.voters.map((voter, index) => {
                // 修正中は、自分の行を隠す（下の入力欄が代わりになる）
                if (voter.is_me && editing) return null;
                return (
                  <tr key={index}>
                    <td style={styles.cell}>
                      {voter.nickname || "名無し"}
                      {voter.is_me && !isExpired && (
                        <button type="button" onClick={() => startEdit(voter)} style={{ ...styles.secondaryButton, marginLeft: "8px", padding: "4px 12px" }}>
                          修正
                        </button>
                      )}
                    </td>

                    {vote.items.map((item) => (
                      <td key={item.product_id} style={styles.cell}>
                        {voter.answers[item.product_id] === "good" ? "○ 賛成" : "× 反対"}
                      </td>
                    ))}
                  </tr>
                );
              })}

              {/* 自分の回答欄 */}
              {showAnswerRow && (
                <tr style={styles.myRow}>
                  <td style={styles.cell}>
                    <label>
                      <span style={styles.nicknameLabel}>あなたの名前（任意・20字まで）</span>

                      <input
                        type="text"
                        value={nickname}
                        maxLength={20}
                        onChange={(e) => setNickname(e.target.value)}
                        placeholder="ニックネーム"
                        style={styles.nicknameInput}
                      />
                    </label>
                  </td>

                  {vote.items.map((item) => (
                    <td key={item.product_id} style={styles.cell}>
                      <div style={styles.answerButtons}>
                        <button
                          type="button"
                          onClick={() => selectAnswer(item.product_id, "good")}
                          style={{
                            ...styles.answerButton,
                            ...(myAnswers[item.product_id] === "good" ? styles.selectedGood : {}),
                          }}
                        >
                          ○ 賛成
                        </button>

                        <button
                          type="button"
                          onClick={() => selectAnswer(item.product_id, "bad")}
                          style={{
                            ...styles.answerButton,
                            ...(myAnswers[item.product_id] === "bad" ? styles.selectedBad : {}),
                          }}
                        >
                          × 反対
                        </button>
                      </div>
                    </td>
                  ))}
                </tr>
              )}
            </tbody>

            {/* 集計（サーバーが数えた結果をそのまま表示） */}
            <tfoot>
              <tr>
                <td style={styles.totalCell}>集計</td>

                {vote.items.map((item) => (
                  <td key={item.product_id} style={styles.totalCell}>
                    賛成 {item.good_count} ／ 反対 {item.bad_count}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>

        {/* 回答ボタン */}
        {showAnswerRow && (
          <div style={styles.submitArea}>
            <button type="button" onClick={submitVote} disabled={submitting} style={styles.primaryButton}>
              {submitting ? "送信中…" : editing ? "回答を修正する" : "回答する"}
            </button>

            {editing && (
              <button type="button" onClick={cancelEdit} disabled={submitting} style={styles.secondaryButton}>
                キャンセル
              </button>
            )}

            <span style={styles.note}>同じブラウザなら、あとから修正できます。</span>
          </div>
        )}

        {/* 回答済みの案内 */}
        {hasAnswered && !editing && !isExpired && (
          <p style={styles.note}>回答済みです。自分の名前の横の「修正」から、書き直せます。</p>
        )}

        <p style={styles.backLink}>
          <Link href="/mypage">マイページに戻る</Link>
        </p>
      </div>
    </main>
  );
}

// CSS
const styles: { [key: string]: React.CSSProperties } = {
  page: {
    minHeight: "100vh",
    backgroundColor: "#FAF8F5",
    color: "#1F2328",
    fontFamily: '"Noto Sans JP", sans-serif',
  },
  container: {
    maxWidth: "1100px",
    margin: "0 auto",
    padding: "40px 20px",
  },
  heading: {
    fontSize: "30px",
    margin: "0 0 4px",
  },
  description: {
    color: "#5B6168",
    marginBottom: "20px",
  },
  urlCard: {
    display: "flex",
    gap: "12px",
    alignItems: "center",
    flexWrap: "wrap",
    padding: "16px",
    marginBottom: "24px",
    backgroundColor: "#FFFFFF",
    border: "1px solid #E3DED6",
    borderRadius: "12px",
  },
  urlText: {
    flex: "1",
    minWidth: "200px",
    fontSize: "13px",
    overflowWrap: "anywhere",
  },
  expiry: {
    color: "#5B6168",
    fontSize: "14px",
  },
  message: {
    color: "#BE185D",
    fontWeight: "bold",
  },
  expiredMessage: {
    backgroundColor: "#F1EEE9",
    padding: "16px",
    borderRadius: "8px",
    marginBottom: "20px",
    color: "#4A5057",
  },
  tableWrapper: {
    overflowX: "auto",
    backgroundColor: "#FFFFFF",
    border: "1px solid #E3DED6",
    borderRadius: "8px",
  },
  table: {
    borderCollapse: "collapse",
    width: "100%",
    minWidth: "720px",
  },
  headerCell: {
    textAlign: "left",
    padding: "12px",
    borderBottom: "1px solid #E3DED6",
    minWidth: "160px",
    verticalAlign: "top",
  },
  productDescription: {
    fontSize: "12px",
    fontWeight: "normal",
    color: "#5B6168",
    marginTop: "6px",
  },
  cell: {
    padding: "12px",
    borderTop: "1px solid #E3DED6",
    verticalAlign: "middle",
  },
  myRow: {
    backgroundColor: "#FFF1F7",
  },
  nicknameLabel: {
    display: "block",
    fontSize: "12px",
    color: "#5B6168",
    marginBottom: "6px",
  },
  nicknameInput: {
    width: "100%",
    minHeight: "40px",
    padding: "0 8px",
    border: "1px solid #B9B2A7",
    borderRadius: "8px",
    boxSizing: "border-box",
  },
  answerButtons: {
    display: "flex",
    flexWrap: "wrap",
    gap: "6px",
  },
  answerButton: {
    padding: "8px 10px",
    backgroundColor: "#FFFFFF",
    border: "1px solid #B9B2A7",
    borderRadius: "8px",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  selectedGood: {
    backgroundColor: "#BE185D",
    color: "#FFFFFF",
    borderColor: "#BE185D",
  },
  selectedBad: {
    backgroundColor: "#4A5057",
    color: "#FFFFFF",
    borderColor: "#4A5057",
  },
  totalCell: {
    padding: "12px",
    borderTop: "2px solid #1F2328",
    fontWeight: "bold",
    backgroundColor: "#FFF1F7",
    whiteSpace: "nowrap",
  },
  submitArea: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "12px",
    marginTop: "16px",
  },
  primaryButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "12px 24px",
    border: "none",
    borderRadius: "8px",
    backgroundColor: "#BE185D",
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: "15px",
    cursor: "pointer",
    textDecoration: "none",
  },
  secondaryButton: {
    padding: "10px 16px",
    border: "1px solid #B9B2A7",
    borderRadius: "8px",
    backgroundColor: "#FFFFFF",
    color: "#1F2328",
    cursor: "pointer",
    textDecoration: "none",
    fontSize: "14px",
  },
  note: {
    color: "#5B6168",
    fontSize: "13px",
  },
  backLink: {
    marginTop: "32px",
  },
};
