import React, { useState, useEffect, useRef } from 'react';
import { PlayerType, AIDifficulty } from '../types/game';
import { cn } from '../utils/cn';
import { runTrainingBatch, getTrainingInfo, resetWeights, exportWeights, importWeights } from '../utils/aiEngine';
import { initializeGame } from '../utils/gameEngine';

interface SetupProps {
  onStartGame: (
    playerNames: string[],
    playerTypes: PlayerType[],
    aiDifficulties: AIDifficulty[],
    variantGrayWall: boolean,
    variantSpecialFactories: boolean
  ) => void;
  onOpenRules: () => void;
}

const difficultyLabels: Record<AIDifficulty, { label: string; desc: string; color: string }> = {
  easy: { label: '初級', desc: 'ランダム', color: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
  normal: { label: '中級', desc: '貪欲+戦略', color: 'bg-amber-100 text-amber-700 border-amber-300' },
  hard: { label: '最強', desc: 'RL+Minimax', color: 'bg-rose-100 text-rose-700 border-rose-300' },
};

export const Setup: React.FC<SetupProps> = ({ onStartGame, onOpenRules }) => {
  const [numPlayers, setNumPlayers] = useState<2 | 3 | 4>(2);
  const [playerConfigs, setPlayerConfigs] = useState<{ name: string; type: PlayerType; aiDifficulty: AIDifficulty }[]>([
    { name: 'プレイヤー 1', type: 'human', aiDifficulty: 'normal' },
    { name: 'AI (最強)', type: 'ai', aiDifficulty: 'hard' },
    { name: 'AI 3', type: 'ai', aiDifficulty: 'normal' },
    { name: 'AI 4', type: 'ai', aiDifficulty: 'easy' },
  ]);

  const [variantGrayWall, setVariantGrayWall] = useState(false);
  const [variantSpecialFactories, setVariantSpecialFactories] = useState(false);

  // Training state
  const [trainingGames, setTrainingGames] = useState(0);
  const [isTraining, setIsTraining] = useState(false);
  const [trainingProgress, setTrainingProgress] = useState('');
  const [trainingPercent, setTrainingPercent] = useState(0);
  const [trainingSpeed, setTrainingSpeed] = useState('');
  const [customTrainCount, setCustomTrainCount] = useState('5000');
  const [importStatus, setImportStatus] = useState('');
  const trainingRef = useRef(false);
  const trainingStartTime = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const info = getTrainingInfo();
    setTrainingGames(info.count);
  }, []);

  const handleTrain = async (count: number) => {
    if (trainingRef.current || count <= 0) return;
    trainingRef.current = true;
    setIsTraining(true);
    setTrainingPercent(0);
    setTrainingSpeed('');
    setImportStatus('');
    setTrainingProgress(`0 / ${count.toLocaleString()}`);
    trainingStartTime.current = Date.now();

    const batchSize = count >= 10000 ? 100 : count >= 1000 ? 30 : 10;
    const uiInterval = count >= 10000 ? 500 : count >= 1000 ? 100 : batchSize;
    let completed = 0;
    let lastUi = 0;

    const runBatch = () => {
      if (completed >= count || !trainingRef.current) {
        setIsTraining(false);
        trainingRef.current = false;
        const info = getTrainingInfo();
        setTrainingGames(info.count);
        const elapsed = (Date.now() - trainingStartTime.current) / 1000;
        const speed = completed / Math.max(elapsed, 0.001);
        setTrainingProgress(`✅ ${completed.toLocaleString()}局完了 (${elapsed.toFixed(1)}秒, ${speed.toFixed(0)}g/s)`);
        setTrainingPercent(100);
        return;
      }

      const toRun = Math.min(batchSize, count - completed);
      const total = runTrainingBatch(toRun, initializeGame);
      completed += toRun;

      if (completed - lastUi >= uiInterval || completed >= count) {
        lastUi = completed;
        const pct = Math.round((completed / count) * 100);
        setTrainingPercent(pct);
        setTrainingGames(total);

        const elapsed = (Date.now() - trainingStartTime.current) / 1000;
        const speed = completed / Math.max(elapsed, 0.001);
        const remaining = (count - completed) / Math.max(speed, 0.001);
        setTrainingSpeed(`${speed.toFixed(0)} g/s`);
        setTrainingProgress(
          `${completed.toLocaleString()} / ${count.toLocaleString()} (${pct}%) — 残り${remaining < 60 ? `${Math.ceil(remaining)}秒` : `${Math.ceil(remaining / 60)}分`}`
        );
      }

      setTimeout(runBatch, 0);
    };

    setTimeout(runBatch, 0);
  };

  const handleStopTraining = () => {
    trainingRef.current = false;
    setIsTraining(false);
  };

  const handleResetWeights = () => {
    if (window.confirm('学習データをリセットしますか？')) {
      resetWeights();
      setTrainingGames(0);
      setTrainingProgress('リセット完了');
      setImportStatus('');
    }
  };

  const handleExport = () => {
    const json = exportWeights();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `azul_ai_weights_${trainingGames}games_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setImportStatus('エクスポート完了！');
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      const result = importWeights(content);
      if (result.success) {
        const info = getTrainingInfo();
        setTrainingGames(info.count);
        setImportStatus(result.message);
      } else {
        setImportStatus(`❌ ${result.message}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleNameChange = (index: number, name: string) => {
    const newConfigs = [...playerConfigs];
    newConfigs[index].name = name;
    setPlayerConfigs(newConfigs);
  };

  const handleTypeChange = (index: number, type: PlayerType) => {
    const newConfigs = [...playerConfigs];
    newConfigs[index].type = type;
    setPlayerConfigs(newConfigs);
  };

  const handleDifficultyChange = (index: number, difficulty: AIDifficulty) => {
    const newConfigs = [...playerConfigs];
    newConfigs[index].aiDifficulty = difficulty;
    setPlayerConfigs(newConfigs);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const configs = playerConfigs.slice(0, numPlayers);
    const names = configs.map((c, idx) => c.name.trim() || `プレイヤー ${idx + 1}`);
    const types = configs.map((c) => c.type);
    const difficulties = configs.map((c) => c.aiDifficulty);
    onStartGame(names, types, difficulties, variantGrayWall, variantSpecialFactories);
  };

  return (
    <div className="w-full max-w-xl mx-auto bg-white rounded-2xl shadow-xl border p-5 md:p-7 flex flex-col gap-5 animate-in fade-in duration-300 max-h-[95vh] overflow-y-auto">
      <div className="text-center space-y-1">
        <h1 className="text-2xl md:text-3xl font-extrabold text-indigo-950 flex items-center justify-center gap-2 tracking-tight">
          🎨 AZUL
        </h1>
        <p className="text-slate-500 font-medium text-xs">強化学習AI搭載ボードゲーム</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Number of Players */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">プレイヤー人数</label>
          <div className="grid grid-cols-3 gap-2">
            {[2, 3, 4].map((num) => (
              <button key={num} type="button" onClick={() => setNumPlayers(num as 2 | 3 | 4)}
                className={cn('py-1.5 px-3 border-2 rounded-lg font-bold text-sm flex flex-col items-center gap-0.5 transition-all',
                  numPlayers === num ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-600 hover:border-slate-300')}>
                <span>{num}人</span>
                <span className="text-[9px] font-normal text-slate-400">{num === 2 ? '5皿' : num === 3 ? '7皿' : '9皿'}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Player Configs */}
        <div className="space-y-1.5 border-t pt-3">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">プレイヤー設定</label>
          <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
            {playerConfigs.slice(0, numPlayers).map((config, idx) => (
              <div key={idx} className="p-2.5 bg-slate-50 border rounded-xl space-y-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-slate-200 border flex items-center justify-center text-[10px] font-bold text-slate-600 shrink-0">{idx + 1}</div>
                  <input type="text" value={config.name} onChange={(e) => handleNameChange(idx, e.target.value)}
                    placeholder={`プレイヤー ${idx + 1}`} maxLength={12}
                    className="flex-1 px-2 py-1 border rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-0" />
                  <div className="flex bg-white border rounded-lg p-0.5 shadow-sm shrink-0">
                    <button type="button" onClick={() => handleTypeChange(idx, 'human')}
                      className={cn('px-2 py-0.5 text-[10px] font-bold rounded transition-all',
                        config.type === 'human' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-100')}>人間</button>
                    <button type="button" onClick={() => handleTypeChange(idx, 'ai')}
                      className={cn('px-2 py-0.5 text-[10px] font-bold rounded transition-all',
                        config.type === 'ai' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-100')}>AI</button>
                  </div>
                </div>
                {config.type === 'ai' && (
                  <div className="flex items-center gap-1 pl-7">
                    {(['easy', 'normal', 'hard'] as AIDifficulty[]).map((diff) => {
                      const info = difficultyLabels[diff];
                      return (
                        <button key={diff} type="button" onClick={() => handleDifficultyChange(idx, diff)}
                          className={cn('px-2 py-0.5 text-[9px] font-bold rounded border transition-all',
                            config.aiDifficulty === diff ? `${info.color} scale-105` : 'bg-white text-slate-400 border-slate-200')}>
                          {info.label}
                        </button>
                      );
                    })}
                    <span className="text-[8px] text-slate-400 ml-1">{difficultyLabels[config.aiDifficulty].desc}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* RL Training */}
        <div className="border-t pt-3">
          <div className="bg-gradient-to-r from-rose-50 via-orange-50 to-amber-50 border border-rose-200 rounded-xl p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">🧠</span>
                <div>
                  <div className="text-[11px] font-extrabold text-slate-800">強化学習 (TD Learning)</div>
                  <div className="text-[9px] text-slate-500">Self-Playで評価関数を学習</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-mono font-black text-rose-700">{trainingGames.toLocaleString()}</div>
                <div className="text-[8px] text-slate-400 font-bold">ゲーム学習済</div>
              </div>
            </div>

            {isTraining && (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-rose-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-rose-500 via-orange-500 to-amber-500 rounded-full transition-all duration-200"
                      style={{ width: `${Math.max(trainingPercent, 1)}%` }} />
                  </div>
                  <span className="text-[10px] font-mono font-bold text-rose-700 w-10 text-right">{trainingPercent}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[9px] text-slate-500">{trainingProgress}</span>
                  {trainingSpeed && <span className="text-[9px] font-mono text-orange-600">{trainingSpeed}</span>}
                </div>
              </div>
            )}

            {!isTraining && (trainingProgress || importStatus) && (
              <div className="text-[9px] font-bold text-emerald-600">{importStatus || trainingProgress}</div>
            )}

            {/* Training buttons */}
            <div className="space-y-2">
              <div className="flex gap-1.5 flex-wrap">
                {!isTraining ? (
                  <>
                    {[100, 1000, 10000, 100000].map((n) => (
                      <button key={n} type="button" onClick={() => handleTrain(n)}
                        className={cn('px-2 py-1 text-[9px] font-bold rounded-lg shadow-sm transition-all active:scale-95 text-white',
                          n === 100 ? 'bg-rose-500 hover:bg-rose-600' :
                          n === 1000 ? 'bg-rose-600 hover:bg-rose-700' :
                          n === 10000 ? 'bg-orange-600 hover:bg-orange-700' :
                          'bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700')}>
                        {n >= 1000 ? `${n/1000}K` : n}
                      </button>
                    ))}
                  </>
                ) : (
                  <button type="button" onClick={handleStopTraining}
                    className="px-3 py-1 bg-slate-800 hover:bg-slate-900 text-white text-[10px] font-bold rounded-lg">⏹ 停止</button>
                )}
              </div>

              {/* Custom training input */}
              {!isTraining && (
                <div className="flex gap-1.5 items-center">
                  <input type="number" value={customTrainCount} onChange={(e) => setCustomTrainCount(e.target.value)}
                    placeholder="カスタム回数" min="1" max="10000000"
                    className="w-24 px-2 py-1 text-[10px] border rounded-lg focus:outline-none focus:ring-1 focus:ring-rose-400" />
                  <button type="button" onClick={() => handleTrain(parseInt(customTrainCount) || 0)}
                    className="px-2 py-1 bg-rose-700 hover:bg-rose-800 text-white text-[9px] font-bold rounded-lg">
                    学習開始
                  </button>
                  <div className="flex-1" />
                  <button type="button" onClick={handleResetWeights}
                    className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-600 text-[9px] font-bold rounded-lg">リセット</button>
                </div>
              )}

              {/* Export/Import */}
              {!isTraining && (
                <div className="flex gap-1.5 pt-1 border-t border-rose-200">
                  <button type="button" onClick={handleExport}
                    className="flex-1 px-2 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[9px] font-bold rounded-lg flex items-center justify-center gap-1">
                    📤 エクスポート
                  </button>
                  <button type="button" onClick={handleImportClick}
                    className="flex-1 px-2 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] font-bold rounded-lg flex items-center justify-center gap-1">
                    📥 インポート
                  </button>
                  <input type="file" ref={fileInputRef} onChange={handleImportFile} accept=".json" className="hidden" />
                </div>
              )}
            </div>

            <div className="text-[8px] text-slate-400 leading-relaxed border-t border-rose-200 pt-2 space-y-0.5">
              <p>• 序盤は多く取る/2-3列目は1回で完成/4-5列目は2回で/1個だけ置くのは避ける/色の分散禁止/縦列優先</p>
              <p>• 学習データはブラウザに保存。JSONファイルとしてエクスポート/インポート可能</p>
            </div>
          </div>
        </div>

        {/* AI Info */}
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-2.5 space-y-1">
          <div className="text-[10px] font-bold text-indigo-700">🧠 AI戦略</div>
          <div className="text-[8px] text-slate-500 space-y-0.5">
            <p><span className="font-bold text-emerald-600">初級:</span> ランダム</p>
            <p><span className="font-bold text-amber-600">中級:</span> 効率配置・色集中・縦列優先・先手価値を考慮した貪欲探索</p>
            <p><span className="font-bold text-rose-600">最強:</span> 75次元特徴量の学習済み評価関数 + Minimax(深度8)</p>
          </div>
        </div>

        {/* Variants */}
        <div className="space-y-2 border-t pt-3">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ヴァリアント</label>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex items-center gap-2 p-2 border rounded-lg bg-slate-50 cursor-pointer hover:bg-slate-100">
              <input type="checkbox" checked={variantGrayWall} onChange={(e) => setVariantGrayWall(e.target.checked)}
                className="w-3.5 h-3.5 text-indigo-600 rounded" />
              <span className="text-[10px] font-bold text-slate-700">グレイウォール</span>
            </label>
            <label className="flex items-center gap-2 p-2 border rounded-lg bg-slate-50 cursor-pointer hover:bg-slate-100">
              <input type="checkbox" checked={variantSpecialFactories} onChange={(e) => setVariantSpecialFactories(e.target.checked)}
                className="w-3.5 h-3.5 text-indigo-600 rounded" />
              <span className="text-[10px] font-bold text-slate-700">特殊工場</span>
            </label>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onOpenRules}
            className="flex-1 py-2.5 border-2 border-slate-200 text-slate-600 font-bold rounded-xl text-sm hover:border-slate-300">📜 ルール</button>
          <button type="submit"
            className="flex-[2] py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-xl text-sm shadow-md">🎮 ゲーム開始</button>
        </div>
      </form>
    </div>
  );
};
export default Setup;
