import React from 'react';

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RulesModal: React.FC<RulesModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose} />
      
      <div className="relative bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto shadow-2xl border flex flex-col p-6 gap-4 z-10 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center border-b pb-3">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            🎨 Azul (アズール) ルール説明
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors font-bold text-xl leading-none w-8 h-8 flex items-center justify-center"
          >
            ×
          </button>
        </div>

        <div className="flex-1 space-y-5 text-sm text-slate-600 leading-relaxed">
          {/* 準備 */}
          <section className="space-y-2">
            <h3 className="font-bold text-slate-800 text-base border-l-4 border-indigo-500 pl-2">ゲーム準備</h3>
            <p>
              袋に「赤・青・黄・黒・水色(シアン)」の各タイル20枚（計100枚）を入れます。<br />
              テーブル中央に丸皿（ファクトリーディスプレイ）を並べます。<br />
              <span className="font-semibold text-indigo-600">（2人プレイで5枚 / 3人プレイで7枚 / 4人プレイで9枚）</span><br />
              中央に「1」と書かれた「ファーストプレイヤータイル」を置き、各丸皿の上に袋からランダムに4枚ずつタイルを配置してゲームを開始します。
            </p>
          </section>

          {/* タイルの獲得 */}
          <section className="space-y-2">
            <h3 className="font-bold text-slate-800 text-base border-l-4 border-indigo-500 pl-2">タイルの獲得（ドラフト）</h3>
            <p>手番では、以下のいずれかの方法で場からタイルを獲得します：</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <span className="font-semibold text-slate-800">① 丸皿から獲得：</span> 
                丸皿1つを選び、その皿にある<span className="font-semibold text-indigo-600">任意の1色のタイル全て</span>を獲得します。残りのタイルはすべて「場の中央」へ移動します。
              </li>
              <li>
                <span className="font-semibold text-slate-800">② 場の中央から獲得：</span> 
                場の中央にあるタイルから<span className="font-semibold text-indigo-600">任意の1色のタイル全て</span>を獲得します。<br />
                <span className="text-amber-600 font-medium">※各ラウンドで「最初」に中央からタイルを獲得したプレイヤーは、同時に「ファーストプレイヤータイル」を受け取り、自分の床ライン（失点）に配置します。このプレイヤーは次ラウンドのスタートプレイヤーとなります。</span>
              </li>
            </ul>
          </section>

          {/* 図案ラインに配置 */}
          <section className="space-y-2">
            <h3 className="font-bold text-slate-800 text-base border-l-4 border-indigo-500 pl-2">図案ラインに配置</h3>
            <p>
              獲得したタイルは、個人ボード左側の階段状の「図案ライン（1〜5段、右詰め）」の<span className="font-semibold text-indigo-600">いずれか1つの段</span>に配置します。
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li><span className="font-semibold">同じ段には同じ色しか置けない：</span> 既にタイルが置かれている段には、同じ色のタイルしか追加できません。</li>
              <li><span className="font-semibold">壁に装飾済みの色は置けない：</span> すでに右側の「壁」に貼られている色のタイルは、同じ段の図案ラインに置くことはできません。</li>
              <li>
                <span className="font-semibold text-rose-600">床ライン（ペナルティ）：</span> 
                段の容量を超えたタイルや、どの段にも配置できない（または配置したくない）タイルは、ボード下部の「床ライン」に左詰めで置かれます。これはラウンド終了時にマイナス点になります。
              </li>
            </ul>
          </section>

          {/* 壁の装飾と得点 */}
          <section className="space-y-2">
            <h3 className="font-bold text-slate-800 text-base border-l-4 border-indigo-500 pl-2">壁の装飾と得点</h3>
            <p>場（皿と中央）のすべてのタイルがなくなったら、ラウンドを終了し「壁の装飾」を行います。</p>
            <p className="font-semibold text-slate-800">【壁のタイル貼り】</p>
            <p>
              図案ラインの各段を確認し、<span className="font-semibold text-emerald-600">「完全に埋まっている（完成した）段」</span>から、右詰めの一番右のタイル1枚を、右側の同じ段の「同じ色の壁」に配置します。その段に残った他のタイルは箱（捨て札）に戻します。
              未完成の段にあるタイルは、そのまま次のラウンドに持ち越します。
            </p>
            <p className="font-semibold text-slate-800">【得点計算】</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>壁に貼ったタイルが、上下左右どのタイルとも隣接していない場合：<span className="font-bold text-emerald-600">+1点</span>獲得。</li>
              <li>上下または左右に隣接している場合：繋がっている<span className="font-bold text-emerald-600">「連続した枚数分（置いたタイル含む）」</span>の点数を獲得します。（例：上下に3枚繋がれば3点、左右に4枚繋がれば4点）</li>
              <li>上下と左右が同時に繋がっている場合は、それぞれの点数を合計します。（例：上下3枚、左右4枚なら3＋4＝7点）</li>
              <li>
                <span className="font-semibold text-rose-600">床ラインの減点：</span> 
                床ラインに置かれたタイル1枚につき、マスに書かれたマイナス値（-1, -1, -2, -2, -2, -3, -3）を合計して持ち点から引きます。点数は0点未満にはなりません。
              </li>
            </ul>
            <p className="text-xs text-slate-400">※床ラインのタイルは箱に戻し（ファーストプレイヤーは中央へ）、新しいラウンドをセットアップします。</p>
          </section>

          {/* ゲーム終了 */}
          <section className="space-y-2">
            <h3 className="font-bold text-slate-800 text-base border-l-4 border-indigo-500 pl-2">ゲームの終了とボーナス得点</h3>
            <p>
              いずれかのプレイヤーが壁のタイルを<span className="font-bold text-rose-600">「横一列（5枚）」</span>完成させたラウンドで、ゲームが即座に終了します。
            </p>
            <p className="font-semibold text-slate-800">【ゲーム終了時ボーナス】</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><span className="font-semibold text-slate-800">横列コンプリート：</span> 壁が横一列完成しているごとに <span className="font-bold text-indigo-600">+2点</span></li>
              <li><span className="font-semibold text-slate-800">縦列コンプリート：</span> 壁が縦一列完成しているごとに <span className="font-bold text-indigo-600">+7点</span></li>
              <li><span className="font-semibold text-slate-800">カラーコンプリート：</span> 壁に同じ色のタイルを5枚すべて配置している色ごとに <span className="font-bold text-indigo-600">+10点</span></li>
            </ul>
            <p>
              これらのボーナスを合計し、最も得点が高いプレイヤーが勝利！<br />
              <span className="text-xs font-semibold text-slate-500">※同点の場合は、「完成させた横一列の数」が多いプレイヤーが勝利します。</span>
            </p>
          </section>

          {/* ヴァリアントルール */}
          <section className="space-y-2 border-t pt-3">
            <h3 className="font-bold text-slate-800 text-base border-l-4 border-pink-500 pl-2">🎮 ヴァリアント（特殊ルール）</h3>
            
            <div className="bg-pink-50/50 p-3 rounded-xl border border-pink-100 space-y-2">
              <p className="font-semibold text-pink-700 text-xs uppercase tracking-wider">● グレイウォール（自由配置）</p>
              <p className="text-xs">
                壁に貼るタイルの色が最初から指定されていません！<br />
                図案ラインが完成して壁にタイルを貼る際、その段の<span className="font-semibold">空いている好きな列に自由に</span>タイルを配置できます。<br />
                <span className="font-bold text-rose-600">【制約】同じ横列、および同じ縦列に「同じ色」のタイルを複数配置することはできません。</span> パズルのように計画的な配置が求められます！
              </p>
            </div>

            <div className="bg-amber-50/50 p-3 rounded-xl border border-amber-100 space-y-2">
              <p className="font-semibold text-amber-700 text-xs uppercase tracking-wider">● 特殊工場 (マスターショコラティエ)</p>
              <p className="text-xs">
                ゲーム開始時、プレイヤー人数と同じ枚数の皿が「特殊な効果を持つ皿（特殊工場）」に置き換わります（場所と効果はゲーム中固定）。
              </p>
              <ul className="list-disc pl-4 text-xs space-y-1">
                <li><span className="font-semibold">➕5枚（Type 1）：</span> ラウンド開始時に袋からタイルを4枚ではなく「5枚」引き、この皿に置きます。</li>
                <li><span className="font-semibold">🧲磁石（Type 2）：</span> ラウンド開始時、左右に隣接する皿に指定の色があれば奪って、この皿に集めます。</li>
                <li><span className="font-semibold">🛑残存（Type 3）：</span> この皿からタイルを選んだ時、他の色のタイルは「中央」に行かず、この皿に残ります！</li>
                <li><span className="font-semibold">↔️分割（Type 4）：</span> この皿からタイルを選んだ時、他のタイルは中央に行かず、左右の皿に均等に振り分けられます。</li>
                <li><span className="font-semibold">🛡️床化（Type 5）：</span> この皿から獲得した時、余りのタイルは通常通り中央へ行きます。その後、獲得プレイヤーはこの空いた皿を自分のボード脇に置き、<span className="font-bold text-indigo-600">「次に受ける床ラインのペナルティを1つ無効化（スキップ）」</span>します！</li>
              </ul>
            </div>
          </section>
        </div>

        <div className="border-t pt-3 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md transition-all active:scale-95 text-sm"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
export default RulesModal;
