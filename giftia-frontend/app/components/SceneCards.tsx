import Link from "next/link";

// トップ画面の「シーンから探す」カード。
// 送別だけ特集ページ（/scenes/farewell）があるので、押せるカードにしている。
// ほかのシーンはまだ画面が無いので「準備中」と表示する（押せない）。
// シーンの名前は、検索フォームの「シーン」の選択肢（app/page.tsx）と同じ9つ。
type Scene = {
  name: string;   // カードに出すシーン名
  href?: string;  // あれば、押したときに進む先（特集ページ）
  tag?: string;   // 写真枠の左上に出す小さなラベル
};

const scenes: Scene[] = [
  { name: "誕生日" },
  { name: "送別", href: "/scenes/farewell", tag: "外さない10選" },
  { name: "お礼" },
  { name: "母の日" },
  { name: "お歳暮" },
  { name: "お中元" },
  { name: "結婚祝い" },
  { name: "父の日" },
  { name: "出産祝い" },
];

export default function SceneCards() {
  return (
    <section aria-labelledby="scene-heading">
      <div className="sectionHead">
        <h2 id="scene-heading" className="sectionTitle">シーンから探す</h2>
        <span className="sectionNote">贈る場面から選べます</span>
      </div>

      <div className="sceneGrid">
        {scenes.map((scene) => {
          // 写真の枠と、シーン名＋リンク文言（どのカードも同じ作り）
          const inside = (
            <>
              <div className="sceneImage" aria-hidden="true">
                シーン写真
                {scene.tag && <span className="sceneTag">{scene.tag}</span>}
              </div>
              <div className="sceneBody">
                <div className="sceneName">{scene.name}</div>
                <div className={scene.href ? "sceneLink" : "sceneLink soon"}>
                  {scene.href ? "特集ページへ →" : "準備中"}
                </div>
              </div>
            </>
          );

          // 特集ページがあるカード → リンク。無いカード → ふつうの枠
          return scene.href ? (
            <Link key={scene.name} href={scene.href} className="sceneCard featured">
              {inside}
            </Link>
          ) : (
            <div key={scene.name} className="sceneCard">
              {inside}
            </div>
          );
        })}
      </div>
    </section>
  );
}
