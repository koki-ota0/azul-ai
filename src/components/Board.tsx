import React from 'react';
import { PlayerBoard, TileColor, WallCell } from '../types/game';
import { Tile } from './Tile';
import { WALL_LAYOUT } from '../utils/gameEngine';
import { cn } from '../utils/cn';

interface BoardProps {
  board: PlayerBoard;
  isActive: boolean;
  isValidTargetRows?: boolean[]; // [bool, bool, bool, bool, bool] for pattern rows 1-5
  isPlacing?: boolean; // true if a tile is currently selected and we are waiting for target
  onRowClick?: (rowIndex: number) => void;
  onFloorClick?: () => void;
}

export const Board: React.FC<BoardProps> = ({
  board,
  isActive,
  isValidTargetRows = [false, false, false, false, false],
  isPlacing = false,
  onRowClick,
  onFloorClick,
}) => {
  const floorPenalties = [1, 1, 2, 2, 2, 3, 3];

  const getWallCellBg = (_rowIndex: number, _colIndex: number, cell: WallCell, isGrayWall: boolean) => {
    if (cell.placed) {
      return ''; // Handled by the Tile component
    }

    if (isGrayWall) {
      return 'bg-slate-200/50 border-slate-300';
    }

    const color = cell.color;
    switch (color) {
      case 'blue': return 'bg-blue-600/10 border-blue-200 text-blue-300';
      case 'red': return 'bg-red-500/10 border-red-200 text-red-300';
      case 'yellow': return 'bg-amber-400/10 border-amber-200 text-amber-300';
      case 'black': return 'bg-slate-800/10 border-slate-300 text-slate-300';
      case 'cyan': return 'bg-cyan-500/10 border-cyan-200 text-cyan-300';
    }
  };

  const getWallCellPattern = (color: TileColor) => {
    switch (color) {
      case 'blue': return 'B';
      case 'red': return 'R';
      case 'yellow': return 'Y';
      case 'black': return 'K';
      case 'cyan': return 'C';
    }
  };

  return (
    <div
      className={cn(
        'w-full max-w-2xl rounded-2xl p-4 md:p-6 shadow-xl border bg-white flex flex-col gap-4 relative overflow-hidden transition-all',
        isActive 
          ? 'border-indigo-500 ring-2 ring-indigo-200 scale-[1.01]' 
          : 'border-slate-200 opacity-90'
      )}
    >
      {/* Background decoration for Active Player */}
      {isActive && (
        <div className="absolute top-0 right-0 h-1 w-full bg-gradient-to-r from-indigo-500 to-violet-500" />
      )}

      {/* Header: Player Info */}
      <div className="flex justify-between items-center border-b pb-2">
        <div className="flex items-center gap-2">
          <div className={cn(
            "w-3 h-3 rounded-full",
            isActive ? "bg-indigo-500 animate-pulse" : "bg-slate-300"
          )} />
          <h3 className="font-bold text-slate-800 flex items-center gap-1.5 md:text-lg">
            {board.name}
            {board.type === 'ai' && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border select-none ${
                board.aiDifficulty === 'hard'
                  ? 'bg-rose-100 text-rose-700 border-rose-300'
                  : board.aiDifficulty === 'normal'
                  ? 'bg-amber-100 text-amber-700 border-amber-300'
                  : 'bg-emerald-100 text-emerald-700 border-emerald-300'
              }`}>
                AI {board.aiDifficulty === 'hard' ? '最強' : board.aiDifficulty === 'normal' ? '中級' : '初級'}
              </span>
            )}
          </h3>
        </div>
        <div className="bg-slate-100 rounded-lg px-3 py-1 flex items-center gap-1 border">
          <span className="text-xs font-semibold text-slate-500">SCORE</span>
          <span className="text-lg font-extrabold text-indigo-700 font-mono">{board.score}</span>
        </div>
      </div>

      {/* Main Board Grid: Pattern Lines on Left, Wall on Right */}
      <div className="grid grid-cols-[1fr_auto_1.2fr] gap-4 md:gap-8 items-center py-2">
        
        {/* Left: Pattern Lines (図案ライン) */}
        <div className="flex flex-col gap-2 items-end">
          {board.patternLines.map((line, rowIndex) => {
            const isValid = isValidTargetRows[rowIndex];
            const capacity = rowIndex + 1;

            return (
              <div
                key={rowIndex}
                onClick={() => {
                  if (isActive && isPlacing && isValid && onRowClick) {
                    onRowClick(rowIndex);
                  }
                }}
                className={cn(
                  'flex gap-1.5 items-center p-1 rounded-md transition-all',
                  isActive && isPlacing && isValid && 'bg-emerald-50 border border-emerald-400 border-dashed cursor-pointer hover:bg-emerald-100 scale-[1.02] shadow-sm',
                  isActive && isPlacing && !isValid && 'opacity-30'
                )}
              >
                {/* Visual feedback if a line is valid for clicking */}
                {isActive && isPlacing && isValid && (
                  <span className="text-[10px] text-emerald-600 font-extrabold animate-bounce mr-1">
                    配置
                  </span>
                )}

                {/* Empty spaces + Tiles on the line (Right-justified) */}
                <div className="flex gap-1.5">
                  {Array(capacity)
                    .fill(null)
                    .map((_, colIndex) => {
                      const tile = line[colIndex];
                      if (tile) {
                        return <Tile key={colIndex} color={tile} size="sm" />;
                      } else {
                        return <Tile key={colIndex} color="empty" size="sm" />;
                      }
                    })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Vertical Divider */}
        <div className="w-[1px] h-full bg-slate-200" />

        {/* Right: Wall (壁) */}
        <div className="grid grid-cols-5 gap-1.5 justify-center items-center">
          {board.wall.map((row, rIndex) =>
            row.map((cell, cIndex) => {
              if (cell.placed) {
                return <Tile key={`${rIndex}-${cIndex}`} color={cell.color} size="sm" />;
              }

              const isCellStandard = WALL_LAYOUT[rIndex][cIndex] === cell.color;
              const cellBgClass = getWallCellBg(rIndex, cIndex, cell, !isCellStandard);

              return (
                <div
                  key={`${rIndex}-${cIndex}`}
                  className={cn(
                    'w-7 h-7 text-[10px] font-bold rounded flex items-center justify-center border transition-all select-none',
                    cellBgClass
                  )}
                  title={!isCellStandard ? '自由配置' : `標準: ${cell.color}`}
                >
                  {isCellStandard && !cell.placed && (
                    <span className="opacity-40">{getWallCellPattern(cell.color)}</span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Bottom: Floor Line (床ライン) */}
      <div className="border-t pt-3 flex flex-col gap-1.5">
        <div className="flex justify-between items-center text-xs text-slate-400 font-semibold px-1 select-none">
          <span>床ライン (ペナルティ)</span>
          {isActive && isPlacing && (
            <span className="text-emerald-600 font-bold animate-pulse flex items-center gap-1">
              ⬇️ 床ライン配置可能
            </span>
          )}
        </div>
        
        <div
          onClick={() => {
            if (isActive && isPlacing && onFloorClick) {
              onFloorClick();
            }
          }}
          className={cn(
            'flex gap-1 p-2 rounded-xl bg-slate-50 border items-center justify-start min-h-[44px] transition-all overflow-x-auto',
            isActive && isPlacing && 'bg-emerald-50/50 border-emerald-400 border-dashed cursor-pointer hover:bg-emerald-100 shadow-inner'
          )}
        >
          {Array(7)
            .fill(null)
            .map((_, index) => {
              const item = board.floor[index];
              const penalty = floorPenalties[index];

              return (
                <div key={index} className="flex flex-col items-center gap-0.5">
                  {item ? (
                    item === 'first' ? (
                      <Tile color="first" size="sm" />
                    ) : item === ('special_5' as any) ? (
                      <Tile color="special_5" size="sm" />
                    ) : (
                      <Tile color={item as TileColor} size="sm" />
                    )
                  ) : (
                    <div className="w-7 h-7 border border-slate-200 border-dashed bg-slate-100/50 rounded flex items-center justify-center text-[9px] font-bold text-slate-300 font-mono select-none">
                      -{penalty}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
};
export default Board;
