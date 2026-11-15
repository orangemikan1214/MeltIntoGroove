"use client";

// 検索画面タブ（けーやさん(仮)が中身を作る）
// チェックの状態は page.tsx が持っていて、props で受け取る
export type SearchTabProps = {
  selectedIds: string[]; // 今チェックが入っている商品ID
  onToggle: (productId: string) => void; // チェックを入れる・外す
  isFull: boolean; // 5件選んでいて、もう選べないとき true
};

export default function SearchTab({ selectedIds, onToggle, isFull }: SearchTabProps) {
  return <p style={{ color: "#5B6168", fontSize: "14px" }}>（検索画面は、あとで作ります）</p>;
}