"use client";

import { useState } from "react";
import {
  ApiError,
  createVote,
  fetchVote,
  getVoterKey,
  submitVoteResponse,
  type VoteAnswerValue,
} from "@/lib/votesApi";

export default function TryVotes() {
  const [ids, setIds] = useState("G0101,G0102,G0103");
  const [token, setToken] = useState("");
  const [text, setText] = useState("");

  // 処理を実行して、結果（またはエラー）を画面に出す
  const show = async (job: () => Promise<unknown>) => {
    try {
      setText(JSON.stringify(await job(), null, 2));
    } catch (error) {
      setText(error instanceof ApiError ? `エラー ${error.status}: ${error.message}` : "エラー: " + String(error));
    }
  };

  const create = () =>
    show(async () => {
      const created = await createVote(ids.split(",").map((id) => id.trim()));
      setToken(created.token);
      return created;
    });

  const get = () => show(() => fetchVote(token));

  const vote = () =>
    show(async () => {
      const detail = await fetchVote(token);
      const answers: Record<string, VoteAnswerValue> = {};
      detail.items.forEach((item) => {
        answers[item.product_id] = "good";
      });
      return submitVoteResponse(token, { voterKey: getVoterKey(), nickname: "テスト", answers });
    });

  return (
    <div style={{ padding: 20, display: "grid", gap: 12 }}>
      <label>
        商品ID（カンマ区切り）
        <input value={ids} onChange={(e) => setIds(e.target.value)} style={{ width: "100%" }} />
      </label>
      <label>
        token
        <input value={token} onChange={(e) => setToken(e.target.value)} style={{ width: "100%" }} />
      </label>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={create}>① 投票ページを作る</button>
        <button onClick={get}>② 取得する</button>
        <button onClick={vote}>③ 全部「賛成」で投票する</button>
      </div>
      <pre>{text}</pre>
    </div>
  );
}