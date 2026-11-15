# recommend.py — シーン別の検索（絞り込み＋点数で並べる）API
#
# 要件定義書 FR-02・6章 に対応する。
#   GET /api/scenes/{scene_code}/recommendations
#   ① 送別向け（product_scenes）・在庫あり・予算・年代 で候補を絞る
#   ② 点数 ＝ 0.4×売れ筋 ＋ 0.2×評価 ＋ 0.4×安心条件 を計算する
#   ③ 点数の高い順に並べ、推薦理由をつけて返す
# LLM は使わない。同じ入力なら、いつでも同じ順位・同じ理由になる。

from statistics import median

from fastapi import APIRouter, HTTPException, Query

from database import fetch_all

router = APIRouter()

# ── 設定（仮置きの値はここにまとめる。テストで見直したらここだけ直す）──────

# URL のシーン名 → DB の scene_tag。Phase1 は送別だけ
SCENES = {"farewell": "送別"}

# 画面から受け取る年代 → product_facts の fact 名
AGE_FACTS = {
    "20s": "age_20s",
    "30s": "age_30s",
    "40s": "age_40s",
    "50s": "age_50s",
    "60s": "age_60s",
}

# 「外さない」安心条件（7つ）。(fact 名, 画面に出す名前)
CONDITIONS = [
    ("room_temp", "常温保存"),
    ("shelf_life_days", "日持ち"),
    ("office_orders", "職場での注文実績"),
    ("practicality", "実用性"),
    ("useful_for_work", "仕事で使える"),
    ("mild_scent", "香りが強くない"),
    ("consumer_goods", "消費財"),
]

SHELF_LIFE_MIN_DAYS = 14  # 日持ち：この日数以上なら満たす

# 点数の重み（合計 1.0）
W_SALES = 0.4   # 売れ筋
W_RATING = 0.2  # 評価
W_SAFE = 0.4    # 安心条件

REVIEW_COUNT_CAP = 50  # レビュー件数がこの数に届かない高評価は割り引く


# ── API ─────────────────────────────────────────

@router.get("/api/scenes/{scene_code}/recommendations")
def scene_recommendations(
    scene_code: str,
    age_group: str = Query(default="", description="相手の年代（20s／30s／40s／50s／60s。空なら指定なし）"),
    price_min: int | None = Query(default=None, ge=0, description="予算の下限（以上）"),
    price_max: int | None = Query(default=None, ge=0, description="予算の上限（以下）"),
    limit: int = Query(default=20, ge=1, le=100, description="返す件数"),
):
    """シーン別に候補を絞り、点数の高い順に返す"""
    # ① 入力のチェック
    scene_tag = SCENES.get(scene_code)
    if scene_tag is None:
        raise HTTPException(status_code=404, detail="このシーンは準備中です")
    if age_group and age_group not in AGE_FACTS:
        raise HTTPException(status_code=422, detail="age_group は 20s／30s／40s／50s／60s のどれかです")
    if price_min is not None and price_max is not None and price_min > price_max:
        raise HTTPException(status_code=422, detail="予算の下限が上限より大きくなっています")

    # ② 候補を取る。年代で絞って0件なら、年代を外して取り直す（relaxed＝true）
    relaxed = False
    candidates = fetch_candidates(scene_tag, AGE_FACTS.get(age_group, ""), price_min, price_max)
    if not candidates and age_group:
        candidates = fetch_candidates(scene_tag, "", price_min, price_max)
        relaxed = True

    # ③ シーン全体の情報（売れ筋順位・安心条件の値）を取る
    sales_rank = fetch_sales_rank(scene_tag)
    facts = fetch_facts(scene_tag)
    office_median = median_office_orders(facts, sales_rank)

    # ④ 点数をつけて並べる
    ranked = rank_candidates(candidates, facts, office_median)

    # ⑤ 画面に返す形にする
    results = [
        to_result(item, i + 1, sales_rank, scene_tag)
        for i, item in enumerate(ranked[:limit])
    ]
    return {
        "scene": scene_tag,
        "total_candidates": len(candidates),
        "relaxed": relaxed,
        "results": results,
    }


# ── DB から取る ──────────────────────────────────

def fetch_candidates(scene_tag: str, age_fact: str, price_min: int | None, price_max: int | None) -> list[dict]:
    """シーン・在庫・予算・年代で候補を絞る（値は %s で渡す）"""
    where = ["s.scene_tag = %s", "p.stock > 0"]  # 在庫切れは出さない
    params: list = [scene_tag]
    if price_min is not None:
        where.append("p.price >= %s")
        params.append(price_min)
    if price_max is not None:
        where.append("p.price <= %s")
        params.append(price_max)
    if age_fact:
        # その年代の行（value＝1）がある商品だけ
        where.append(
            "EXISTS (SELECT 1 FROM product_facts f"
            " WHERE f.product_id = p.product_id AND f.fact = %s AND f.value = 1)"
        )
        params.append(age_fact)
    condition = " AND ".join(where)
    return fetch_all(
        f"""SELECT p.product_id, p.category, p.brand, p.product_name, p.price,
                   p.rating, p.review_count, p.description, p.sales_count
            FROM products p
            JOIN product_scenes s ON s.product_id = p.product_id
            WHERE {condition}""",
        tuple(params),
    )


def fetch_sales_rank(scene_tag: str) -> dict[str, int]:
    """シーン向け・在庫ありの商品の、販売数の順位 {product_id: 順位}"""
    rows = fetch_all(
        """SELECT p.product_id
           FROM products p
           JOIN product_scenes s ON s.product_id = p.product_id
           WHERE s.scene_tag = %s AND p.stock > 0
           ORDER BY p.sales_count DESC, p.product_id""",
        (scene_tag,),
    )
    return {r["product_id"]: i + 1 for i, r in enumerate(rows)}


def fetch_facts(scene_tag: str) -> dict[str, dict[str, int]]:
    """シーン向けの商品の安心条件 {product_id: {fact: value}}"""
    names = [fact for fact, _ in CONDITIONS]
    marks = ", ".join(["%s"] * len(names))
    rows = fetch_all(
        f"""SELECT f.product_id, f.fact, f.value
            FROM product_facts f
            JOIN product_scenes s ON s.product_id = f.product_id
            WHERE s.scene_tag = %s AND f.fact IN ({marks})""",
        (scene_tag, *names),
    )
    facts: dict[str, dict[str, int]] = {}
    for r in rows:
        facts.setdefault(r["product_id"], {})[r["fact"]] = r["value"]
    return facts


# ── 計算（DB を使わないので、テストしやすい）─────────────

def median_office_orders(facts: dict, sales_rank: dict) -> float | None:
    """シーン向け・在庫ありの商品のうち、office_orders の行がある商品の中央値"""
    values = [f["office_orders"] for pid, f in facts.items() if pid in sales_rank and "office_orders" in f]
    return median(values) if values else None


def met_conditions(product_facts: dict[str, int], office_median: float | None) -> list[str]:
    """満たしている安心条件の表示名を返す。行がない条件は「満たさない」"""
    met = []
    for fact, label in CONDITIONS:
        value = product_facts.get(fact)
        if value is None:
            continue
        if fact == "shelf_life_days":
            ok = value >= SHELF_LIFE_MIN_DAYS
        elif fact == "office_orders":
            ok = office_median is not None and value >= office_median
        else:
            ok = value == 1
        if ok:
            met.append(label)
    return met


def rating_score(rating, review_count) -> float:
    """評価：（rating÷5）×（min(レビュー件数, 50)÷50）。rating がなければ 0"""
    if rating is None:
        return 0.0
    return (float(rating) / 5) * (min(review_count or 0, REVIEW_COUNT_CAP) / REVIEW_COUNT_CAP)


def rank_candidates(candidates: list[dict], facts: dict, office_median: float | None) -> list[dict]:
    """候補ごとに点数を出し、高い順に並べる"""
    if not candidates:
        return []
    sales = [r["sales_count"] or 0 for r in candidates]
    lo, hi = min(sales), max(sales)

    items = []
    for r in candidates:
        # 売れ筋：候補の中で最小を0、最大を1に換算（全員同じなら0）
        sales_score = ((r["sales_count"] or 0) - lo) / (hi - lo) if hi > lo else 0.0
        met = met_conditions(facts.get(r["product_id"], {}), office_median)
        safe_score = len(met) / len(CONDITIONS)
        score = W_SALES * sales_score + W_RATING * rating_score(r["rating"], r["review_count"]) + W_SAFE * safe_score
        items.append({"row": r, "score": round(score, 4), "conditions": met})

    # 点数の高い順 → 同点なら販売数が多い順 → それも同じなら product_id が小さい順
    items.sort(key=lambda x: (-x["score"], -(x["row"]["sales_count"] or 0), x["row"]["product_id"]))
    return items


def reason_text(conditions: list[str], rank_in_scene: int | None, scene_tag: str, rating, review_count) -> str:
    """推薦理由の文章（ひな形に当てはめる。要件定義書 6.3）"""
    parts = []
    if conditions:
        parts.append(f"{'・'.join(conditions)}の条件がそろい、")
    if rank_in_scene is not None:
        parts.append(f"{scene_tag}向けの商品の中で販売数が{rank_in_scene}位。")
    parts.append(f"評価は{float(rating or 0):.1f}（{review_count or 0}件）。")
    parts.append("好みが分からない相手にも渡しやすい商品です。")
    return "".join(parts)


def to_result(item: dict, rank: int, sales_rank: dict, scene_tag: str) -> dict:
    """画面に返す1件分。Gift 型（to_gift）に、順位・点数・理由を足す"""
    # main.py の to_gift() を使い回す。
    # ファイルの先頭で読み込むと、main.py と recommend.py がお互いを読み込み合って起動できないため、ここで読み込む
    from main import to_gift

    r = item["row"]
    rank_in_scene = sales_rank.get(r["product_id"])
    return {
        **to_gift(r),
        "rank": rank,
        "score": item["score"],
        "reasons": {
            "conditions": item["conditions"],
            "sales_rank": rank_in_scene,
            "rating": float(r["rating"]) if r["rating"] is not None else 0,
            "review_count": r["review_count"],
            "text": reason_text(item["conditions"], rank_in_scene, scene_tag, r["rating"], r["review_count"]),
        },
    }
