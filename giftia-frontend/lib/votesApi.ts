// 投票機能のAPIを呼ぶ部品（lib/api.ts とは別ファイル）
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// マイページの一覧の、1件ぶん
export type VoteSummary = {
  token: string;
  url_path: string;
  created_at: string;
  expires_at: string;
  expired: boolean;
  voter_count: number;
  items: { product_id: string; product_name: string | null }[];
};

// エラーのとき、status（404・410・422 など）を画面で見分けられるようにする
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// APIを呼ぶ共通の関数
export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    // 送るデータ（body）があるときだけ、「JSONで送る」と伝える
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    cache: "no-store",
    ...init,
  });

  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    } catch {
      // 返事がJSONでなければ、下の statusText を使う
    }
    throw new ApiError(res.status, detail || res.statusText);
  }

  return (await res.json()) as T;
}

// マイページ：自分が作った投票ページの一覧
export function fetchMyVotes(): Promise<{ total: number; votes: VoteSummary[] }> {
  return request("/api/votes");
}

// 商品の情報（商品が見つからないときは null になることがある）
export type VoteProduct = {
  product_id: string;
  product_name: string | null;
  brand: string | null;
  price: number | null;
  rating: number | null;
  review_count: number | null;
};

// 候補1つぶん（商品の情報＋賛成・反対の数）
export type VoteItem = VoteProduct & { good_count: number; bad_count: number };

export type VoteAnswerValue = "good" | "bad";

// 投票した人1人ぶん（nickname が空なら、画面で「名無し」と表示する）
export type VoteVoter = { nickname: string; answers: Record<string, VoteAnswerValue>; is_me: boolean };

// 投票ページの中身
export type VoteDetail = {
  token: string;
  expires_at: string;
  expired: boolean;
  items: VoteItem[];
  voters: VoteVoter[];
};

// 投票ページを作ったときの返事
export type VoteCreated = { token: string; url_path: string; expires_at: string };

// 投票ページを作る（商品は2〜5個）
export function createVote(productIds: string[], sceneCode = "farewell"): Promise<VoteCreated> {
  return request<VoteCreated>("/api/votes", {
    method: "POST",
    body: JSON.stringify({ scene_code: sceneCode, product_ids: productIds }),
  });
}

// 投票ページの中身を取る
export function fetchVote(token: string, voterKey?: string): Promise<VoteDetail> {
  const query = voterKey ? `?voter_key=${encodeURIComponent(voterKey)}` : "";
  return request<VoteDetail>(`/api/votes/${encodeURIComponent(token)}${query}`);
}

// 投票を保存する（全候補ぶんをまとめて送る。同じ voterKey で送り直すと上書き）
export function submitVoteResponse(
  token: string,
  params: { voterKey: string; nickname?: string; answers: Record<string, VoteAnswerValue> },
): Promise<VoteDetail> {
  return request<VoteDetail>(`/api/votes/${encodeURIComponent(token)}/responses`, {
    method: "POST",
    body: JSON.stringify({
      voter_key: params.voterKey,
      nickname: params.nickname ?? "",
      answers: Object.entries(params.answers).map(([product_id, value]) => ({ product_id, value })),
    }),
  });
}

// ブラウザごとの乱数（同じブラウザの人を見分ける印。個人は特定しない）
export function getVoterKey(): string {
  if (typeof window === "undefined") return "";
  try {
    let key = window.localStorage.getItem("giftia_voter_key");
    if (!key) {
      key = crypto.randomUUID();
      window.localStorage.setItem("giftia_voter_key", key);
    }
    return key;
  } catch {
    return crypto.randomUUID(); // localStorage が使えないときは、その場かぎり
  }
}

// 日付の表示（例：2026/11/28）。サーバーの日時には「Z」（世界標準時）が付いていないので、付けて読む
export function formatDate(iso: string): string {
  const hasZone = /[zZ]$|[+-]\d{2}:\d{2}$/.test(iso);
  return new Date(hasZone ? iso : `${iso}Z`).toLocaleDateString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}