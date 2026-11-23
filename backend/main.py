# main.py — Giftia 検索API（2週目・穴埋め版）
# 【穴1】〜【穴4】を、対応表と公式ドキュメント・データ定義.md を頼りに自分で埋める。
# 埋めるまでは ___ が残っていて動かない（/api/search を呼ぶと 500 になり、ターミナルに NameError と行番号が出る）。
# 答えは 配布コード/答え合わせ/backend/main.py（自分で埋めてから見る）。
#
# 画面（Next.js）から呼ばれる「窓口」。条件を受け取り、班のDBを検索して、結果を JSON で返す。
# 起動：uvicorn main:app --reload
# 確認：http://localhost:8000/docs（Swagger UI。ブラウザから API を試せる）

import os

from dotenv import load_dotenv
from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import secrets
import uuid
from typing import Literal
from database import fetch_all, create_vote, get_vote, get_vote_for_response, save_ballots, list_votes, find_scene_product_ids
from recommend import router as recommend_router  # シーン別の検索（FR-02）
from recommend import reasons_for_products  # 投票ページ用

load_dotenv()  # .env を読む（DB の接続情報・CORS の許可）

app = FastAPI(title="Giftia Search API（2週目）")

# ── CORS ───────────────────────────────────────
# 画面（http://localhost:3000）と API（http://localhost:8000）は別のアプリ＝オリジンが違う。
# ブラウザは既定で「別オリジンへの通信」を止めるので、API 側が「この画面からは受け付ける」と宣言する。
# 許可する画面の URL は .env の CORS_ORIGINS に書く（カンマ区切りで複数可）。空なら何も許可しない。
origins = [o.strip() for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_methods=["GET", "POST"], allow_headers=["*"])

# シーン別の検索 API（recommend.py）をつなぐ
app.include_router(recommend_router)

@app.get("/api/health")
def health():
    """つながっているかの確認。どの DB に何件の商品があるか"""
    row = fetch_all("SELECT DATABASE() AS db, COUNT(*) AS products FROM products")[0]
    return {"status": "ok", "db": row["db"], "products": row["products"]}


@app.get("/api/search")
def search(
    q: str = Query(default="", description="キーワード（空白区切りで複数。すべてを含む商品）"),
    category: str = Query(default="", description="カテゴリー（空ならすべて）"),
    indiv_wrap: bool = Query(default=False, description="true なら、説明文に「個包装」とある商品だけ"),
    price_min: int | None = Query(default=None, ge=0, description="価格の下限（以上）"),
    price_max: int | None = Query(default=None, ge=0, description="価格の上限（以下）"),
    limit: int = Query(default=20, ge=1, le=100, description="返す件数"),
):
    """条件に合う商品を、人気順（直近1年の販売数）で上位 limit 件返す"""
    # ① 条件を WHERE に1つずつ足す（値は %s で渡し、SQL の文字列に直接つなげない）
    where, params = ["stock > 0"], []  # 在庫切れは出さない
    for word in q.split():  # 【穴1】q を空白で区切って1語ずつにする（文字列のメソッド）
        where.append("(product_name LIKE %s OR brand LIKE %s OR description LIKE %s)")
        params += [f"%{word}%"] * 3
    if category:
        where.append("category = %s")
        params.append(category)  # 【穴2】%s に入れる値（受け取ったカテゴリー）
    if indiv_wrap:
        where.append("description LIKE %s")  # 「個包装」は列がないので、説明文に書いてあるかで見る
        params.append("%個包装%")  # 【穴3】「個包装」をどこかに含む、という LIKE のパターン
    if price_min is not None:
        where.append("price >= %s")
        params.append(price_min)
    if price_max is not None:
        where.append("price <= %s")
        params.append(price_max)
    condition = " AND ".join(where)

    # ② 件数と、人気順の上位 limit 件を取る
    total = fetch_all(f"SELECT COUNT(*) AS n FROM products WHERE {condition}", tuple(params))[0]["n"]
    rows = fetch_all(
        f"""SELECT product_id, category, brand, product_name, price, rating, review_count, description
            FROM products WHERE {condition}
            ORDER BY sales_count DESC, product_id
            LIMIT %s""",
        (*params, limit),
    )
    # ③ DB の行を、画面の Gift 型（1週目）に詰め替えて返す
    return {"total": total, "results": [to_gift(r) for r in rows]}


def to_gift(r: dict) -> dict:
    """DB の列名 → 画面（lib/api.ts の Gift 型）の項目名。画面側は1週目のまま変えない"""
    return {
        "id": r["product_id"],
        "category": r["category"],
        "brand": r["brand"],
        "name": r["product_name"],  # 【穴4】商品名の列名（データ定義.md の products を見る）
        "price": r["price"],
        "rating": float(r["rating"]) if r["rating"] is not None else 0,  # レビューなしは 0
        "reviewCount": r["review_count"],
        "description": r.get("description", ""),  #追加。DB に列がない場合は空文字
    }
# ===== 投票機能（ここから） =====
CURRENT_USER_ID = "demo-user"          # ログイン済みの仮ユーザー（ログインを作ったら差し替える）
SCENE_TAGS = {"farewell": "送別"}      # シーンのコード → product_scenes の scene_tag


class VoteCreate(BaseModel):
    scene_code: str
    product_ids: list[str]


@app.post("/api/votes", status_code=201)
def post_vote(body: VoteCreate):
    """投票ページを作る"""
    ids = body.product_ids

    # 1. 入力のチェック（おかしければ 422 を返して、ここで終わる）
    scene_tag = SCENE_TAGS.get(body.scene_code)
    if scene_tag is None:
        raise HTTPException(status_code=422, detail="このシーンは対応していません")
    if not 2 <= len(ids) <= 5:
        raise HTTPException(status_code=422, detail="商品は2〜5個選んでください")
    if len(set(ids)) != len(ids):
        raise HTTPException(status_code=422, detail="同じ商品は2回選べません")

    # 2. 送別向けの商品だけか、MySQLで確かめる
    if find_scene_product_ids(scene_tag, ids) != set(ids):
        raise HTTPException(status_code=422, detail="送別向けではない商品が含まれています")

    # 3. 保存する（token は推測されにくい16文字）。期限も一緒に受け取る
    token = secrets.token_urlsafe(12)
    created = create_vote(token, body.scene_code, CURRENT_USER_ID, ids)

    # 4. 返す
    return {"token": token, "url_path": f"/votes/{token}", "expires_at": created["expires_at"]}

@app.get("/api/votes/{token}")
def get_vote_detail(token: str, voter_key: str | None = None):
    """投票内容の取得（期限切れでも結果は見られる）voter_key を付けると、自分の回答に is_me が付く"""
    key = None
    if voter_key:
        try:
            key = str(uuid.UUID(voter_key))
        except ValueError:
            key = None  # voter_key が正しい UUID でなければ無視する
    vote = get_vote(token, key)
    if vote is None:
        raise HTTPException(status_code=404, detail="この投票ページは見つかりません")
    return with_reasons(vote)  # 投票の各商品に、推薦理由 reasons を足す

class AnswerIn(BaseModel):
    product_id: str
    value: Literal["good", "bad"]


class ResponseIn(BaseModel):
    voter_key: str
    nickname: str = Field(default="", max_length=20)
    answers: list[AnswerIn]


@app.post("/api/votes/{token}/responses")
def post_vote_response(token: str, body: ResponseIn):
    """投票結果を保存する（全候補ぶんをまとめて受け取る。同じ voter_key の再投票は上書き）"""
    # 1. voter_key が UUID の形か確かめて、書き方をそろえる（大文字・小文字の違いで別人にならないように）
    try:
        voter_key = str(uuid.UUID(body.voter_key))
    except ValueError:
        raise HTTPException(status_code=422, detail="voter_key が正しくありません")

    # 2. 投票ページがあるか、期限切れでないか
    vote = get_vote_for_response(token)
    if vote is None:
        raise HTTPException(status_code=404, detail="この投票ページは見つかりません")
    if vote["expired"]:
        raise HTTPException(status_code=410, detail="この投票ページは有効期限が切れています")

    # 3. 全部の候補に、1回ずつ答えているか
    answered = [answer.product_id for answer in body.answers]
    if len(answered) != len(set(answered)) or set(answered) != vote["product_ids"]:
        raise HTTPException(status_code=422, detail="すべての候補に回答してください")

    # 4. 保存して、最新の投票内容を返す
    answers = {answer.product_id: answer.value for answer in body.answers}
    save_ballots(vote["vote_id"], voter_key, body.nickname.strip(), answers)
    return with_reasons(get_vote(token, voter_key))  # 保存後の最新の投票内容を返す（自分の回答に is_me が付く）

@app.get("/api/votes")
def get_my_votes():
    """マイページの一覧（自分が作った投票ページ。新しい順。期限切れも含む）"""
    votes = list_votes(CURRENT_USER_ID)
    return {"total": len(votes), "votes": votes}

def with_reasons(vote: dict) -> dict:
    """投票の各商品（items）に、推薦理由 reasons を足す。特集から選んだ等で理由がなければ None"""
    reasons = reasons_for_products("送別", [i["product_id"] for i in vote["items"]])
    for item in vote["items"]:
        item["reasons"] = reasons.get(item["product_id"])
    return vote
# ===== 投票機能（ここまで） =====