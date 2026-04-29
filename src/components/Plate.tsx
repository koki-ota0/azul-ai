import React from 'react';
import { FactoryPlate, TileColor } from '../types/game';
import { Tile } from './Tile';
import { cn } from '../utils/cn';

interface PlateProps {
  plate: FactoryPlate;
  isSelected: boolean;
  selectedColor: TileColor | null;
  interactive: boolean;
  onTileClick: (color: TileColor) => void;
}

export const Plate: React.FC<PlateProps> = ({
  plate,
  isSelected,
  selectedColor,
  interactive,
  onTileClick,
}) => {
  const uniqueColors = Array.from(new Set(plate.tiles)) as TileColor[];

  // Render text for special factory
  const getSpecialLabel = () => {
    switch (plate.type) {
      case 'special_1':
        return '➕5枚';
      case 'special_2':
        const jpColors: Record<TileColor, string> = {
          red: '赤', blue: '青', yellow: '黄', black: '黒', cyan: '水色'
        };
        return `🧲${jpColors[plate.specialColor!]}`;
      case 'special_3':
        return '🛑残存';
      case 'special_4':
        return '↔️分割';
      case 'special_5':
        return '🛡️床化';
      default:
        return '';
    }
  };

  const getSpecialDescription = () => {
    switch (plate.type) {
      case 'special_1':
        return 'ラウンド開始時、袋からタイルを5枚引く';
      case 'special_2':
        const jpColors: Record<TileColor, string> = {
          red: '赤', blue: '青', yellow: '黄', black: '黒', cyan: '水色'
        };
        return `ラウンド開始時、隣接する皿から${jpColors[plate.specialColor!]}を奪う`;
      case 'special_3':
        return '選んだ色以外のタイルは場の中央に移動せず、この皿に残る';
      case 'special_4':
        return '選んだ色以外のタイルは中央に移動せず、左右の皿に分割される';
      case 'special_5':
        return '獲得時、余ったタイルは中央へ行き、この皿はペナルティ1回無効化アイテムとして獲得される';
      default:
        return '通常工場';
    }
  };

  return (
    <div
      className={cn(
        'relative w-28 h-28 md:w-36 md:h-36 rounded-full border-4 border-amber-100 bg-amber-50/40 shadow-inner flex items-center justify-center transition-all p-2 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-50 to-orange-50/40',
        isSelected && 'border-indigo-500 scale-105 shadow-md shadow-indigo-200 bg-indigo-50/10'
      )}
    >
      {/* Plate ID or Special Badge */}
      <div 
        className={cn(
          "absolute -top-1 -left-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full border shadow-sm z-20 select-none",
          plate.type === 'normal' 
            ? "bg-slate-100 text-slate-500 border-slate-200" 
            : "bg-gradient-to-r from-pink-500 to-rose-500 text-white border-pink-400 font-extrabold"
        )}
        title={getSpecialDescription()}
      >
        {plate.type === 'normal' ? plate.id + 1 : getSpecialLabel()}
      </div>

      {plate.tiles.length === 0 ? (
        <span className="text-xs text-amber-300 select-none italic font-medium">空</span>
      ) : (
        <div className="grid grid-cols-2 gap-1.5 p-2 justify-center items-center">
          {uniqueColors.map((color) => {
            const count = plate.tiles.filter((c) => c === color).length;
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
export default Plate;
