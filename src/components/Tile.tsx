import React from 'react';
import { TileColor } from '../types/game';
import { cn } from '../utils/cn';

interface TileProps {
  color: TileColor | 'first' | 'empty' | 'special_5';
  size?: 'sm' | 'md' | 'lg';
  interactive?: boolean;
  selected?: boolean;
  onClick?: () => void;
  count?: number;
}

export const Tile: React.FC<TileProps> = ({
  color,
  size = 'md',
  interactive = false,
  selected = false,
  onClick,
  count,
}) => {
  const sizeClasses = {
    sm: 'w-7 h-7 text-xs font-bold rounded-sm',
    md: 'w-10 h-10 text-sm font-bold rounded',
    lg: 'w-14 h-14 text-lg font-bold rounded-md',
  };

  if (color === 'empty') {
    return (
      <div
        className={cn(
          sizeClasses[size],
          'bg-slate-100 border border-slate-200 border-dashed transition-all'
        )}
      />
    );
  }

  if (color === 'special_5') {
    return (
      <div
        onClick={onClick}
        className={cn(
          sizeClasses[size],
          'flex items-center justify-center border-2 border-dashed border-pink-500 bg-pink-50 text-pink-600 shadow-sm relative',
          interactive && 'cursor-pointer hover:scale-105 active:scale-95'
        )}
        title="特殊工場効果：ペナルティ無効化"
      >
        <span className={size === 'sm' ? 'text-[8px]' : 'text-[10px]'}>🛡️</span>
      </div>
    );
  }

  if (color === 'first') {
    return (
      <div
        onClick={onClick}
        className={cn(
          sizeClasses[size],
          'flex items-center justify-center bg-white border border-slate-300 text-amber-600 font-extrabold shadow-sm relative overflow-hidden',
          interactive && 'cursor-pointer hover:scale-105 active:scale-95 hover:border-amber-400',
          selected && 'ring-2 ring-amber-500 scale-105 shadow-md z-10'
        )}
      >
        {/* Background decorative ring */}
        <div className="absolute inset-1 rounded-full border border-amber-100 flex items-center justify-center">
          <span className={size === 'sm' ? 'text-xs' : size === 'md' ? 'text-lg' : 'text-2xl'}>1</span>
        </div>
      </div>
    );
  }

  // Define patterns based on color
  const renderPattern = () => {
    switch (color) {
      case 'blue':
        return (
          <svg className="w-full h-full text-blue-200" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="0.5">
            <path d="M0,0 L20,20 M20,0 L0,20 M10,0 L10,20 M0,10 L20,10" />
            <circle cx="10" cy="10" r="4" fill="none" />
            <rect x="2" y="2" width="16" height="16" fill="none" strokeWidth="1" />
          </svg>
        );
      case 'red':
        return (
          <svg className="w-full h-full text-red-100" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1">
            <polygon points="10,2 18,10 10,18 2,10" fill="none" />
            <circle cx="10" cy="10" r="2" fill="currentColor" />
            <line x1="10" y1="0" x2="10" y2="20" strokeWidth="0.5" />
            <line x1="0" y1="10" x2="20" y2="10" strokeWidth="0.5" />
          </svg>
        );
      case 'yellow':
        return (
          <svg className="w-full h-full text-yellow-600/30" viewBox="0 0 20 20" fill="currentColor">
            <circle cx="10" cy="10" r="5" />
            <circle cx="10" cy="10" r="2" fill="white" />
            <path d="M10,0 L12,4 L16,4 L14,8 L18,10 L14,12 L16,16 L12,16 L10,20 L8,16 L4,16 L6,12 L2,10 L6,8 L4,4 L8,4 Z" fill="none" stroke="currentColor" strokeWidth="0.5" />
          </svg>
        );
      case 'black':
        return (
          <svg className="w-full h-full text-white/20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
            <line x1="0" y1="5" x2="20" y2="5" />
            <line x1="0" y1="15" x2="20" y2="15" />
            <line x1="5" y1="0" x2="5" y2="20" />
            <line x1="15" y1="0" x2="15" y2="20" />
            <circle cx="10" cy="10" r="1.5" fill="currentColor" />
          </svg>
        );
      case 'cyan':
        return (
          <svg className="w-full h-full text-cyan-200" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1">
            <circle cx="5" cy="5" r="1.5" fill="currentColor" />
            <circle cx="15" cy="5" r="1.5" fill="currentColor" />
            <circle cx="5" cy="15" r="1.5" fill="currentColor" />
            <circle cx="15" cy="15" r="1.5" fill="currentColor" />
            <path d="M10,2 L10,18 M2,10 L18,10" strokeWidth="0.5" />
            <rect x="5" y="5" width="10" height="10" rx="2" fill="none" strokeWidth="0.5" />
          </svg>
        );
    }
  };

  const bgClasses = {
    blue: 'bg-blue-600 border border-blue-700 shadow-blue-900/30 shadow-inner',
    red: 'bg-red-500 border border-red-600 shadow-red-900/30 shadow-inner',
    yellow: 'bg-amber-400 border border-amber-500 shadow-amber-600/30 shadow-inner',
    black: 'bg-slate-800 border border-slate-900 shadow-black/40 shadow-inner',
    cyan: 'bg-cyan-500 border border-cyan-600 shadow-cyan-600/30 shadow-inner',
  }[color];

  return (
    <div
      onClick={onClick}
      className={cn(
        sizeClasses[size],
        bgClasses,
        'relative shadow-md overflow-hidden flex items-center justify-center p-1 select-none transition-all',
        interactive && 'cursor-pointer hover:scale-105 hover:brightness-110 active:scale-95',
        selected && 'ring-4 ring-offset-1 ring-indigo-500 scale-105 z-10 shadow-lg'
      )}
    >
      {renderPattern()}
      {count && count > 1 && (
        <span className={cn(
          'absolute bottom-0 right-1 font-extrabold drop-shadow-md text-white select-none',
          size === 'sm' ? 'text-[9px]' : size === 'md' ? 'text-xs' : 'text-base'
        )}>
          {count}
        </span>
      )}
    </div>
  );
};
