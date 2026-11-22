# database.py — 班のDB（Azure Database for MySQL）につなぐ（穴なし。置いて、読む）
#
# 接続情報は .env に置く（Workbench に入れたものと同じ5つ）。コードに書かない。GitHub に上げない。
#   DB_HOST     = ホスト名（xxx.mysql.database.azure.com）
#   DB_PORT     = 3306
#   DB_USER     = 配られたユーザー名（例 tech0gen13-class1）
#   DB_PASSWORD = 班のパスワード
#   DB_NAME     = 班のDB名（例 giftia_t101 ＝ クラス1の班1）
#   DB_SSL_CA   = 配布された SSL証明書のパス（任意。入れると Workbench の「Verify CA」と同じく相手を確かめる）

import os
from contextlib import contextmanager 
import pymysql
from dotenv import load_dotenv
from dbutils.pooled_db import PooledDB

load_dotenv()  # 同じフォルダの .env を読み、os.environ に入れる


def get_connection():
    """班のDBへの接続を1つ作って返す。使い終わったら close() する（fetch_all が面倒を見る）"""
    required = ["DB_HOST", "DB_USER", "DB_PASSWORD", "DB_NAME"]
    missing = [k for k in required if not os.environ.get(k)]
    if missing:
        raise EnvironmentError(f".env に設定がありません: {', '.join(missing)}（.env.example を .env にコピーして埋める）")

    # Azure は暗号化（SSL/TLS）しない接続を断る。証明書のパスがあれば、相手が Azure のサーバーかも確かめる
    ssl = {"ca": os.environ["DB_SSL_CA"]} if os.environ.get("DB_SSL_CA") else {"ssl_disabled": False}

    return pymysql.connect(
        host=os.environ["DB_HOST"],
        port=int(os.environ.get("DB_PORT", "3306")),
        user=os.environ["DB_USER"],
        password=os.environ["DB_PASSWORD"],
        database=os.environ["DB_NAME"],
        charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor,  # 行を {列名: 値} の形で受け取る（JSON にしやすい）
        connect_timeout=10,
        ssl=ssl,
    )


def fetch_all(query: str, params: tuple = ()) -> list[dict]:
    """SELECT を実行して、行を dict のリストで返す。
    値は params で渡す（SQL の中の %s に入る）。文字列に直接つなげると、入力次第で DB を壊される。"""
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(query, params)
            return cur.fetchall()
    finally:
        conn.close()

# ===== 投票機能（ここから） =====
_pool = None

def get_pooled_connection():
    """使い回す接続を1つ借りる。close() すると、閉じずにプールへ返る。"""
    global _pool
    if _pool is None:
        _pool = PooledDB(
            creator=get_connection,  # 新しい接続が要るときは、これまでの get_connection を使う
            maxconnections=10,       # 同時に使える最大数
            mincached=2,             # 最初に用意しておく数
            maxcached=5,             # 余らせておく最大数
            blocking=True,           # 全部使用中なら、空くまで待つ
            ping=1,                  # 借りるとき、生きているか確認（切れていたら繋ぎ直す）
        )
    return _pool.connection()

@contextmanager
def read_cursor():
    """読み取り用。1回の接続で、続けて何回でも SELECT できる（接続が1回で済む）"""
    conn = get_pooled_connection()
    try:
        with conn.cursor() as cur:
            yield cur
    finally:
        conn.close()
        
@contextmanager
def transaction():
    """書き込み用。with の中が全部成功したら commit、途中で失敗したら rollback（全部なかったことに）する"""
    conn = get_pooled_connection()
    try:
        with conn.cursor() as cur:
            yield cur
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

def find_scene_product_ids(scene_tag: str, product_ids: list[str]) -> set[str]:
    """product_ids のうち、そのシーン向けの商品のIDを返す（接続は使い回す）"""
    placeholders = ",".join(["%s"] * len(product_ids))
    with read_cursor() as cur:
        cur.execute(
            f"SELECT product_id FROM product_scenes WHERE scene_tag = %s AND product_id IN ({placeholders})",
            (scene_tag, *product_ids),
        )
        return {row["product_id"] for row in cur.fetchall()}

def create_vote(token: str, scene_code: str, user_id: str, product_ids: list[str], days: int = 14) -> dict:
    """投票ページを作る（votes に1行、vote_items に候補の行）。vote_id と expires_at を返す。
    途中で失敗したら、votes の行も取り消される。"""
    with transaction() as cur:
        cur.execute(
            "INSERT INTO votes (token, scene_code, user_id, expires_at) "
            "VALUES (%s, %s, %s, DATE_ADD(NOW(), INTERVAL %s DAY))",
            (token, scene_code, user_id, days),
        )
        vote_id = cur.lastrowid
        cur.executemany(
            "INSERT INTO vote_items (vote_id, product_id, sort_order) VALUES (%s, %s, %s)",
            [(vote_id, product_id, order) for order, product_id in enumerate(product_ids, start=1)],
        )
        cur.execute("SELECT expires_at FROM votes WHERE vote_id = %s", (vote_id,))
        expires_at = cur.fetchone()["expires_at"]
    return {"vote_id": vote_id, "expires_at": expires_at}

def get_vote(token: str, voter_key: str | None = None) -> dict | None:
    """token の投票ページを返す。なければ None。
    候補（商品）、賛成・反対の数、投票者ごとの回答、期限切れかどうかを入れる。"""

    # 1〜3 を、1回の接続でまとめて取る
    with read_cursor() as cur:
        # 1. 投票ページ本体（期限切れかどうかは、MySQLの NOW() と比べて決める）
        cur.execute(
            "SELECT vote_id, token, expires_at, (expires_at <= NOW()) AS expired FROM votes WHERE token = %s",
            (token,),
        )
        votes = cur.fetchall()
        if not votes:
            return None
        vote = votes[0]

        # 2. 候補の商品（名前や価格は products から持ってくる）
        cur.execute(
            "SELECT vi.product_id, p.product_name, p.brand, p.price, p.rating, p.review_count "
            "FROM vote_items vi LEFT JOIN products p ON p.product_id = vi.product_id "
            "WHERE vi.vote_id = %s ORDER BY vi.sort_order",
            (vote["vote_id"],),
        )
        items = cur.fetchall()

        # 3. これまでの投票（1票=1行）
        cur.execute(
            "SELECT voter_key, nickname, product_id, value FROM vote_ballots WHERE vote_id = %s ORDER BY ballot_id",
            (vote["vote_id"],),
        )
        ballots = cur.fetchall()
    # 4. 商品ごとの賛成・反対の数を数える
    for item in items:
        item["good_count"] = sum(1 for b in ballots if b["product_id"] == item["product_id"] and b["value"] == "good")
        item["bad_count"] = sum(1 for b in ballots if b["product_id"] == item["product_id"] and b["value"] == "bad")

    # 5. 投票者ごとにまとめる（voter_key は他の人に見せないので、返す内容には入れない）
    voters = {}
    for b in ballots:
        voter = voters.setdefault(b["voter_key"], {"nickname": b["nickname"] or "", "answers": {}, "is_me": b["voter_key"] == voter_key},)
        voter["answers"][b["product_id"]] = b["value"]

    return {
        "token": vote["token"],
        "expires_at": vote["expires_at"],
        "expired": bool(vote["expired"]),
        "items": items,
        "voters": list(voters.values()),
    }

def get_vote_for_response(token: str) -> dict | None:
    """投票を受け付けてよいかの判断に使う情報（期限切れか、候補の商品IDは何か）。なければ None"""
    with read_cursor() as cur:
        cur.execute(
            "SELECT vote_id, (expires_at <= NOW()) AS expired FROM votes WHERE token = %s",
            (token,),
        )
        votes = cur.fetchall()
        if not votes:
            return None
        vote = votes[0]
        cur.execute("SELECT product_id FROM vote_items WHERE vote_id = %s", (vote["vote_id"],))
        items = cur.fetchall()
    return {
        "vote_id": vote["vote_id"],
        "expired": bool(vote["expired"]),
        "product_ids": {item["product_id"] for item in items},
    }


def save_ballots(vote_id: int, voter_key: str, nickname: str, answers: dict[str, str]) -> None:
    """全候補ぶんの回答を保存する。同じ voter_key の再投票は上書き。途中で失敗したら全部取り消し"""
    with transaction() as cur:
        cur.executemany(
            "INSERT INTO vote_ballots (vote_id, product_id, voter_key, value, nickname) "
            "VALUES (%s, %s, %s, %s, %s) "
            "ON DUPLICATE KEY UPDATE value = VALUES(value), nickname = VALUES(nickname), voted_at = NOW()",
            [(vote_id, product_id, voter_key, value, nickname) for product_id, value in answers.items()],
        )

def list_votes(user_id: str) -> list[dict]:
    """user_id が作った投票ページの一覧（新しい順）。期限切れも含める"""

    with read_cursor() as cur:
        # 1. 投票ページの一覧（回答した人数は、サブクエリで数える）
        cur.execute(
            "SELECT v.vote_id, v.token, v.created_at, v.expires_at, "
            "(v.expires_at <= NOW()) AS expired, "
            "(SELECT COUNT(DISTINCT b.voter_key) FROM vote_ballots b WHERE b.vote_id = v.vote_id) AS voter_count "
            "FROM votes v WHERE v.user_id = %s "
            "ORDER BY v.created_at DESC, v.vote_id DESC",
            (user_id,),
        )
        votes = cur.fetchall()
        if not votes:
            return []

        # 2. 全部の投票ページの候補を、まとめて1回で取る
        ids = [v["vote_id"] for v in votes]
        placeholders = ",".join(["%s"] * len(ids))
        cur.execute(
            "SELECT vi.vote_id, vi.product_id, p.product_name "
            "FROM vote_items vi LEFT JOIN products p ON p.product_id = vi.product_id "
            f"WHERE vi.vote_id IN ({placeholders}) "
            "ORDER BY vi.vote_id, vi.sort_order",
            tuple(ids),
        )
        items = cur.fetchall()

    # 3. 候補を、投票ページごとにまとめる
    by_vote = {}
    for item in items:
        by_vote.setdefault(item["vote_id"], []).append(
            {"product_id": item["product_id"], "product_name": item["product_name"]}
        )

    return [
        {
            "token": v["token"],
            "url_path": f"/votes/{v['token']}",
            "created_at": v["created_at"],
            "expires_at": v["expires_at"],
            "expired": bool(v["expired"]),
            "voter_count": v["voter_count"],
            "items": by_vote.get(v["vote_id"], []),
        }
        for v in votes
    ]
# ===== 投票機能（ここまで） =====