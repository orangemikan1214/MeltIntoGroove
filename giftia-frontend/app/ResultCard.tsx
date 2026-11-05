// app/ResultCard.tsx — 結果カード（部品）。2週目の変更は import の1行だけ（Gift 型の置き場所が lib/api.ts に変わった）
"use client"; // ← ブラウザで動く合図。useState や onClick を使う画面に必要

import {useState} from "react";
import type { Gift } from "@/lib/api";

export default function ResultCard({ gift, rank }: { gift: Gift; rank: number }) {

  const [isOpen, setIsOpen] = useState(false); // 詳細を開くかどうか
  return (
    <div className="card" onClick={() => setIsOpen(!isOpen)} style={{ cursor: "pointer" }}>
      <p className="meta">{rank}位・{gift.category}・{gift.brand}</p>
      <h3 className="name">{gift.name}</h3>
      <p className="price">{gift.price.toLocaleString()}円</p>
      <p className="meta">評価{gift.rating}（{gift.reviewCount}件）</p>
      {/* 詳細を開くボタン */}
      {isOpen && (
        <p className="description">
          {gift.description}
        </p>
      )}
      <p className="meta">
        {isOpen ? "閉じる▲" : "詳細を開く"}
      </p>
    </div>
  );
}
