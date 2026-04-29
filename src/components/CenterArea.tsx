import React from 'react';
import { TileColor } from '../types/game';
import { Tile } from './Tile';
import { cn } from '../utils/cn';

interface CenterAreaProps {
  tiles: TileColor[];
  hasFirstPlayerTile: boolean;
  isSelected: boolean;
  selectedColor: TileColor | null;
  interactive: boolean;
  onTileClick: (color: TileColor) => void;
}

export const CenterArea: React.FC<CenterAreaProps> = ({
  tiles,
  hasFirstPlayerTile,
  isSelected,
  selectedColor,
  interactive,
  onTileClick,
}) => {
  const uniqueColors = Array.from(new Set(tiles)) as TileColor[];
  const isEmpty = tiles.length === 0 && !hasFirstPlayerTile;

  return (
    <div
      className={cn(
        'relative min-h-[110px] w-full max-w-xl mx-auto rounded-2xl border-4 border-dashed border-slate-300 bg-slate-50/50 p-4 flex flex-wrap items-center justify-center gap-4 transition-all',
        isSelected && 'border-indigo-400 bg-indigo-50/20 shadow-md shadow-indigo-100'
      )}
    >
      <div className="absolute -top-3 left-4 bg-white px-2 py-0.5 text-xs text-slate-400 font-bold border border-slate-200 rounded shadow-sm select-none">
        場の中央
      </div>

      {isEmpty ? (
        <span className="text-sm text-slate-400 select-none italic">空</span>
      ) : (
        <div className="flex flex-wrap items-center justify-center gap-3">
          {hasFirstPlayerTile && (
            <Tile color="first" size="md" />
          )}

          {uniqueColors.map((color) => {
            const count = tiles.filter((c) => c === color).length;
            const isColorSelected = isSelected && selectedColor === color;

            return (
              <Tile
                key={color}
                color={color}
                count={count}
                size="md"
                interactive={interactive}
                selected={isColorSelected}
                onClick={() => interactive && onTileClick(color)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};
export default CenterArea;
