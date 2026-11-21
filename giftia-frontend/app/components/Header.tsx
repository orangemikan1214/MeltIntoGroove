import Link from "next/link";

// 全ページ共通のヘッダー。
// ・ロゴ → トップ画面（/）へ戻る
// ・「ログイン中」の表示 → 本物のログイン機能はまだ無いので、仮の表示
// ・マイページ → /mypage（app/mypage/page.tsx）へ進む
// マイページを開いているときは current="mypage" を渡す（リンクではなく、いまの場所の表示になる）
type HeaderProps = {
  current?: "mypage";
};

// 人のかたちのアイコン（飾りなので、読み上げからは外す）
const personIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="8" r="3.8" />
    <path d="M4.5 20c.8-3.8 3.9-6 7.5-6s6.7 2.2 7.5 6" />
  </svg>
);

export default function Header({ current }: HeaderProps) {
  return (
    <header className="siteHeader">
      <div className="siteHeaderInner">
        {/* ロゴ → トップ画面 */}
        <Link href="/" className="siteLogo">
          Giftia<span className="siteLogoDot">.</span>
        </Link>

        <nav className="siteNav" aria-label="アカウント">
          <span className="siteUser">ログイン中：[ユーザー名]さん</span>

          {current === "mypage" ? (
            // いまマイページを開いている：押せない表示
            <span className="siteMyPage current" aria-current="page">
              {personIcon}
              マイページ
            </span>
          ) : (
            // マイページへのリンク → /mypage
            <Link href="/mypage" className="siteMyPage">
              {personIcon}
              マイページ
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
