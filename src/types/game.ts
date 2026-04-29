export type TileColor = 'red' | 'blue' | 'yellow' | 'black' | 'cyan';

export interface Tile {
  id: string;
  color: TileColor;
}

export type PlayerType = 'human' | 'ai';
export type AIDifficulty = 'easy' | 'normal' | 'hard';

export interface WallCell {
  color: TileColor;
  placed: boolean;
}

export interface PlayerBoard {
  id: string;
  name: string;
  type: PlayerType;
  aiDifficulty: AIDifficulty;
  score: number;
  patternLines: (TileColor | null)[][]; // 5 rows, lengths 1 to 5. Null means empty.
  wall: WallCell[][]; // 5x5 grid
  floor: (TileColor | 'first')[]; // max 7
  completedHorizontalRows: number;
  completedVerticalRows: number;
  completedColors: number;
}

export interface FactoryPlate {
  id: number;
  tiles: TileColor[];
  type: 'normal' | 'special_1' | 'special_2' | 'special_3' | 'special_4' | 'special_5'; 
  // special factory types corresponding to prompt
  specialColor?: TileColor; // for type 2, the specific color it takes
}

export interface GameState {
  players: PlayerBoard[];
  currentPlayerIndex: number;
  plates: FactoryPlate[];
  center: {
    tiles: TileColor[];
    hasFirstPlayerTile: boolean;
  };
  bag: TileColor[];
  discardPile: TileColor[];
  round: number;
  phase: 'setup' | 'drafting' | 'tiling' | 'scoring' | 'game_over';
  firstPlayerThisRound: string | null; // who took the center tile first
  isFirstPlayerClaimedThisRound: boolean;
  winnerIds: string[];
  log: string[];
  // Setup options
  variantGrayWall: boolean;
  variantSpecialFactories: boolean;
}
