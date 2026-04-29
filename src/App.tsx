import { useState, useEffect, useRef } from 'react';
import { GameState, TileColor, PlayerType } from './types/game';
import type { AIDifficulty } from './types/game';
import { initializeGame, draftTiles, getValidRowsForColor } from './utils/gameEngine';
import { getAIMoveAdvanced, getTrainingInfo } from './utils/aiEngine';
import { Setup } from './components/Setup';
import { Board } from './components/Board';
import { Plate } from './components/Plate';
import { CenterArea } from './components/CenterArea';
import { RulesModal } from './components/RulesModal';
import { Tile } from './components/Tile';
import { cn } from './utils/cn';
import canvasConfetti from 'canvas-confetti';

export default function App() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isRulesOpen, setIsRulesOpen] = useState(false);
  
  // Selection state
  const [selectedSource, setSelectedSource] = useState<'center' | { plateIndex: number } | null>(null);
  const [selectedColor, setSelectedColor] = useState<TileColor | null>(null);
  
  const logEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom of logs
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [gameState?.log]);

  // AI Move Effect
  useEffect(() => {
    if (!gameState) return;
    
    if (gameState.phase === 'drafting') {
      const currentPlayer = gameState.players[gameState.currentPlayerIndex];
      if (currentPlayer.type === 'ai') {
        const thinkTime = currentPlayer.aiDifficulty === 'hard' ? 800 : currentPlayer.aiDifficulty === 'normal' ? 600 : 400;
        const timer = setTimeout(() => {
          const move = getAIMoveAdvanced(gameState);
          handleDraft(move.source, move.color, move.targetRowIndex, gameState.currentPlayerIndex);
        }, thinkTime);
        return () => clearTimeout(timer);
      }
    }
    
    if (gameState.phase === 'game_over') {
      // Fire confetti!
      canvasConfetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 }
      });
    }
  }, [gameState?.currentPlayerIndex, gameState?.phase]);

  const handleStartGame = (
    playerNames: string[],
    playerTypes: PlayerType[],
    aiDifficulties: AIDifficulty[],
    variantGrayWall: boolean,
    variantSpecialFactories: boolean
  ) => {
    const newState = initializeGame(playerNames, playerTypes, aiDifficulties, variantGrayWall, variantSpecialFactories);
    setGameState(newState);
    setSelectedSource(null);
    setSelectedColor(null);
  };

  const handleTileSelect = (source: 'center' | { plateIndex: number }, color: TileColor) => {
    if (!gameState || gameState.phase !== 'drafting') return;
    
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (currentPlayer.type === 'ai') return; // Not human's turn

    // Toggle selection
    if (
      selectedSource && 
      ((source === 'center' && selectedSource === 'center') || 
       (typeof source === 'object' && typeof selectedSource === 'object' && source.plateIndex === selectedSource.plateIndex)) &&
      selectedColor === color
    ) {
      setSelectedSource(null);
      setSelectedColor(null);
    } else {
      setSelectedSource(source);
      setSelectedColor(color);
    }
  };

  const handleDraft = (
    source: 'center' | { plateIndex: number },
    color: TileColor,
    targetRowIndex: number | 'floor',
    playerIndex: number
  ) => {
    if (!gameState) return;
    
    const nextState = draftTiles(gameState, source, color, targetRowIndex, playerIndex);
    setGameState(nextState);
    
    // Reset selection after human move
    if (gameState.players[playerIndex].type === 'human') {
      setSelectedSource(null);
      setSelectedColor(null);
    }
  };

  const handleRowPlacement = (rowIndex: number) => {
    if (!gameState || !selectedSource || !selectedColor) return;
    handleDraft(selectedSource, selectedColor, rowIndex, gameState.currentPlayerIndex);
  };

  const handleFloorPlacement = () => {
    if (!gameState || !selectedSource || !selectedColor) return;
    handleDraft(selectedSource, selectedColor, 'floor', gameState.currentPlayerIndex);
  };

  const handleRestart = () => {
    if (window.confirm('ゲームを終了してタイトルに戻りますか？')) {
      setGameState(null);
      setSelectedSource(null);
      setSelectedColor(null);
    }
  };

  if (!gameState) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 via-white to-indigo-50 p-4 md:p-8">
        <Setup onStartGame={handleStartGame} onOpenRules={() => setIsRulesOpen(true)} />
        <RulesModal isOpen={isRulesOpen} onClose={() => setIsRulesOpen(false)} />
      </div>
    );
  }

  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const isHumanTurn = currentPlayer.type === 'human' && gameState.phase === 'drafting';
  
  // Calculate valid rows for the currently selected color
  const validRows = selectedColor 
    ? getValidRowsForColor(currentPlayer, selectedColor, gameState.variantGrayWall)
    : [false, false, false, false, false];

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <RulesModal isOpen={isRulesOpen} onClose={() => setIsRulesOpen(false)} />

      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 md:px-8 shadow-sm flex justify-between items-center z-10">
        <div className="flex items-center gap-4">
          <h1 
            onClick={handleRestart}
            className="text-xl md:text-2xl font-black text-indigo-950 tracking-wider cursor-pointer hover:opacity-80 flex items-center gap-1.5"
          >
            🎨 AZUL <span className="text-xs font-normal text-slate-400 font-sans tracking-normal">アズール</span>
          </h1>
          <span className="text-xs font-bold px-2 py-1 rounded-full bg-slate-100 text-slate-500 border">
            ラウンド {gameState.round}
          </span>
          {gameState.variantGrayWall && (
            <span className="text-xs font-bold px-2 py-1 rounded-full bg-pink-100 text-pink-700 border border-pink-200">
              グレイウォール
            </span>
          )}
          {gameState.variantSpecialFactories && (
            <span className="text-xs font-bold px-2 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
              特殊工場
            </span>
          )}
          {gameState.players.some(p => p.aiDifficulty === 'hard') && (
            <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-rose-50 text-rose-600 border border-rose-200" title="強化学習済みゲーム数">
              🧠 {getTrainingInfo().count}局学習済
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsRulesOpen(true)}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold rounded-xl text-xs transition-all active:scale-95 border"
          >
            📜 ルール
          </button>
          <button
            onClick={handleRestart}
            className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 font-semibold rounded-xl text-xs transition-all active:scale-95 border border-rose-200"
          >
            🔄 終了
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 flex flex-col lg:flex-row gap-6 max-w-7xl mx-auto w-full">
        
        {/* Left Column: Game Board (Factory displays, center) and Log */}
        <div className="flex-[1.2] flex flex-col gap-6">
          
          {/* Phase Banner */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${isHumanTurn ? 'bg-emerald-500 animate-pulse' : 'bg-indigo-500'}`} />
              <div>
                <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                  {gameState.phase === 'game_over' ? 'ゲーム終了' : '現在の手番'}
                </div>
                <div className="font-extrabold text-slate-800 text-base md:text-lg">
                  {gameState.phase === 'game_over' ? (
                    '👑 ゲーム終了！'
                  ) : (
                    <>
                      {currentPlayer.name}{' '}
                      <span className="font-normal text-slate-500 text-sm">
                        {isHumanTurn 
                          ? 'の番です（タイルを選択してください）' 
                          : currentPlayer.type === 'ai'
                          ? `の番です（${currentPlayer.aiDifficulty === 'hard' ? '🧠最強AI' : currentPlayer.aiDifficulty === 'normal' ? '💡中級AI' : '🎲初級AI'} 思考中...）`
                          : 'の番です（思考中...）'}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {selectedColor && isHumanTurn && (
              <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-xl px-3 py-1.5 animate-in fade-in slide-in-from-right-5 duration-200">
                <span className="text-xs font-bold text-indigo-700">選択中:</span>
                <Tile color={selectedColor} size="sm" />
                <span className="text-xs text-slate-500 font-medium">配置先を選んでください</span>
              </div>
            )}
          </div>

          {/* Plates Grid */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col gap-6 items-center">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider self-start mb-2">
              丸皿（ファクトリーディスプレイ）
            </div>
            
            <div className="flex flex-wrap justify-center gap-4 md:gap-6 max-w-2xl">
              {gameState.plates.map((plate, idx) => {
                const isSelected = 
                  selectedSource !== null && 
                  typeof selectedSource === 'object' && 
                  selectedSource.plateIndex === idx;
                  
                return (
                  <Plate
                    key={plate.id}
                    plate={plate}
                    isSelected={isSelected}
                    selectedColor={selectedColor}
                    interactive={isHumanTurn}
                    onTileClick={(color) => handleTileSelect({ plateIndex: idx }, color)}
                  />
                );
              })}
            </div>
          </div>

          {/* Center Area */}
          <CenterArea
            tiles={gameState.center.tiles}
            hasFirstPlayerTile={gameState.center.hasFirstPlayerTile}
            isSelected={selectedSource === 'center'}
            selectedColor={selectedColor}
            interactive={isHumanTurn}
            onTileClick={(color) => handleTileSelect('center', color)}
          />

          {/* Game Log */}
          <div className="bg-slate-950 rounded-2xl border border-slate-800 p-4 shadow-xl flex flex-col h-[180px] md:h-[220px]">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 border-b border-slate-800 pb-1 flex items-center gap-1.5">
              <span>📝 ゲームログ</span>
            </div>
            <div className="flex-1 overflow-y-auto space-y-1 pr-1 font-mono text-xs leading-relaxed text-slate-300">
              {gameState.log.map((entry, idx) => {
                let textClass = 'text-slate-300';
                if (entry.includes('ゲームを開始')) textClass = 'text-indigo-400 font-bold border-b border-indigo-900/50 pb-1 mb-1';
                else if (entry.includes('ラウンド')) textClass = 'text-amber-400 font-bold border-b border-amber-950 pb-1 mt-2 mb-1';
                else if (entry.includes('完成！')) textClass = 'text-emerald-400 font-bold';
                else if (entry.includes('ペナルティ:')) textClass = 'text-rose-400';
                else if (entry.includes('獲得しました')) textClass = 'text-slate-400';
                else if (entry.includes('🏆 ゲーム終了')) textClass = 'text-pink-400 font-extrabold text-sm border-t border-pink-900 pt-2 mt-2 bg-pink-950/20 p-2 rounded';
                else if (entry.startsWith('---')) textClass = 'text-indigo-300 font-semibold mt-1 opacity-80';
                else if (entry.startsWith('===')) textClass = 'text-amber-300 font-bold mt-2';

                return (
                  <div key={idx} className={`${textClass} transition-all duration-150`}>
                    {entry}
                  </div>
                );
              })}
              <div ref={logEndRef} />
            </div>
          </div>
        </div>

        {/* Right Column: Players' Boards */}
        <div className="flex-1 flex flex-col gap-6">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            プレイヤーボード
          </div>
          
          <div className="flex flex-col gap-6 overflow-y-auto max-h-[85vh] pr-2">
            {/* Show current player board first for easy visibility, then other players! */}
            {/* Or simply show in order but style the current player differently */}
            {gameState.players.map((board, idx) => {
              const isActive = gameState.currentPlayerIndex === idx;
              const isPlacing = isActive && selectedSource !== null && selectedColor !== null;

              return (
                <div key={board.id} className="animate-in fade-in slide-in-from-bottom-5 duration-300">
                  <Board
                    board={board}
                    isActive={isActive}
                    isPlacing={isPlacing}
                    isValidTargetRows={isActive ? validRows : [false, false, false, false, false]}
                    onRowClick={handleRowPlacement}
                    onFloorClick={handleFloorPlacement}
                  />
                </div>
              );
            })}
          </div>
        </div>

      </main>

      {/* Game Over Screen Overlay */}
      {gameState.phase === 'game_over' && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border p-6 text-center space-y-6 shadow-2xl animate-in fade-in zoom-in-95 duration-300 flex flex-col items-center">
            <div className="space-y-1">
              <span className="text-4xl">👑</span>
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">
                ゲーム終了！
              </h2>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">
                最終結果
              </p>
            </div>

            {/* Winner Badge */}
            <div className="bg-indigo-50 border-2 border-indigo-100 rounded-2xl p-4 w-full flex flex-col items-center gap-1.5 shadow-inner">
              <span className="text-xs text-indigo-600 font-extrabold tracking-wider uppercase">
                WINNER
              </span>
              <span className="text-2xl font-black text-slate-800">
                {gameState.players
                  .filter((p) => gameState.winnerIds.includes(p.id))
                  .map((p) => p.name)
                  .join(', ')}
              </span>
              <span className="text-indigo-700 font-mono font-extrabold text-3xl mt-1">
                {Math.max(...gameState.players.map((p) => p.score))} <span className="text-xs font-sans font-bold text-slate-500">点</span>
              </span>
            </div>

            {/* Scoreboard */}
            <div className="w-full space-y-2 border-t pt-4">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block text-left mb-2">
                順位表
              </span>
              {[...gameState.players]
                .sort((a, b) => b.score - a.score || b.completedHorizontalRows - a.completedHorizontalRows)
                .map((player, idx) => {
                  const isWinner = gameState.winnerIds.includes(player.id);
                  return (
                    <div
                      key={player.id}
                      className={cn(
                        'flex justify-between items-center px-4 py-2 rounded-xl border',
                        isWinner 
                          ? 'bg-amber-50 border-amber-300 font-bold shadow-sm' 
                          : 'bg-slate-50 border-slate-200'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          'w-5 h-5 rounded-full border text-xs flex items-center justify-center font-extrabold',
                          idx === 0 ? 'bg-amber-100 border-amber-400 text-amber-700' : 'bg-slate-200 text-slate-600'
                        )}>
                          {idx + 1}
                        </span>
                        <span className="text-sm text-slate-700 font-medium">
                          {player.name}
                          {player.type === 'ai' && (
                            <span className={`ml-1 text-[9px] font-bold px-1 py-0.5 rounded ${
                              player.aiDifficulty === 'hard' ? 'bg-rose-100 text-rose-700' 
                              : player.aiDifficulty === 'normal' ? 'bg-amber-100 text-amber-700' 
                              : 'bg-emerald-100 text-emerald-700'
                            }`}>
                              AI{player.aiDifficulty === 'hard' ? '最強' : player.aiDifficulty === 'normal' ? '中級' : '初級'}
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-[10px] text-slate-400 flex gap-2">
                          <span>横:{player.completedHorizontalRows}</span>
                          <span>縦:{player.completedVerticalRows}</span>
                          <span>色:{player.completedColors}</span>
                        </div>
                        <span className="font-mono font-extrabold text-slate-800 text-base">
                          {player.score}点
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 w-full border-t pt-4">
              <button
                onClick={() => setGameState(null)}
                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-xl text-sm shadow-md transition-all active:scale-95 flex items-center justify-center gap-1"
              >
                🎮 タイトルへ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
