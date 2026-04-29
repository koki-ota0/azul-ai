import { GameState, PlayerBoard, TileColor, PlayerType, AIDifficulty, FactoryPlate, WallCell } from '../types/game';

// Standard wall layout colors
export const WALL_LAYOUT: TileColor[][] = [
  ['blue', 'yellow', 'red', 'black', 'cyan'],
  ['cyan', 'blue', 'yellow', 'red', 'black'],
  ['black', 'cyan', 'blue', 'yellow', 'red'],
  ['red', 'black', 'cyan', 'blue', 'yellow'],
  ['yellow', 'red', 'black', 'cyan', 'blue'],
];

const FLOOR_PENALTIES = [-1, -1, -2, -2, -2, -3, -3];

export function createInitialBag(): TileColor[] {
  const colors: TileColor[] = ['red', 'blue', 'yellow', 'black', 'cyan'];
  const bag: TileColor[] = [];
  colors.forEach((color) => {
    for (let i = 0; i < 20; i++) {
      bag.push(color);
    }
  });
  // Shuffle bag
  return shuffleArray(bag);
}

function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function initializeGame(
  playerNames: string[],
  playerTypes: PlayerType[],
  aiDifficulties: AIDifficulty[],
  variantGrayWall: boolean,
  variantSpecialFactories: boolean
): GameState {
  const numPlayers = playerNames.length;
  const numPlates = numPlayers === 2 ? 5 : numPlayers === 3 ? 7 : 9;

  const bag = createInitialBag();
  const discardPile: TileColor[] = [];

  const players: PlayerBoard[] = playerNames.map((name, index) => {
    // Create empty wall
    const wall: WallCell[][] = Array(5)
      .fill(null)
      .map((_, rowIndex) =>
        Array(5)
          .fill(null)
          .map((_, colIndex) => ({
            color: variantGrayWall ? 'blue' : WALL_LAYOUT[rowIndex][colIndex], // default color for gray wall is arbitrary, we just track 'placed' and when placed, we assign color
            placed: false,
          }))
      );

    const patternLines: (TileColor | null)[][] = Array(5)
      .fill(null)
      .map((_, i) => Array(i + 1).fill(null));

    return {
      id: `p${index + 1}`,
      name,
      type: playerTypes[index],
      aiDifficulty: aiDifficulties[index] || 'normal',
      score: 0,
      patternLines,
      wall,
      floor: [],
      completedHorizontalRows: 0,
      completedVerticalRows: 0,
      completedColors: 0,
    };
  });

  // Determine special factory types if variant is on
  // Prompt: Randomly place special factory plates equal to the number of players, rest are normal.
  const plates: FactoryPlate[] = [];
  const allSpecialTypes: { type: FactoryPlate['type']; color?: TileColor }[] = [
    { type: 'special_1' },
    { type: 'special_2', color: 'red' },
    { type: 'special_2', color: 'blue' },
    { type: 'special_2', color: 'yellow' },
    { type: 'special_2', color: 'black' },
    { type: 'special_2', color: 'cyan' },
    { type: 'special_3' },
    { type: 'special_4' },
    { type: 'special_5' },
  ];

  let chosenSpecialFactories = shuffleArray([...allSpecialTypes]).slice(0, numPlayers);
  
  // Decide which plate indices get the special factories (randomize them)
  const plateIndices = Array.from({ length: numPlates }, (_, i) => i);
  const shuffledPlateIndices = shuffleArray([...plateIndices]);
  const specialIndices = shuffledPlateIndices.slice(0, numPlayers);

  for (let i = 0; i < numPlates; i++) {
    let type: FactoryPlate['type'] = 'normal';
    let specialColor: TileColor | undefined = undefined;

    if (variantSpecialFactories && specialIndices.includes(i)) {
      const specFact = chosenSpecialFactories.pop()!;
      type = specFact.type;
      specialColor = specFact.color;
    }

    plates.push({
      id: i,
      tiles: [],
      type,
      specialColor,
    });
  }

  const gameState: GameState = {
    players,
    currentPlayerIndex: 0,
    plates,
    center: {
      tiles: [],
      hasFirstPlayerTile: true,
    },
    bag,
    discardPile,
    round: 1,
    phase: 'setup',
    firstPlayerThisRound: null,
    isFirstPlayerClaimedThisRound: false,
    winnerIds: [],
    log: ['ゲームを開始します！'],
    variantGrayWall,
    variantSpecialFactories,
  };

  return fillPlatesAndStartRound(gameState);
}

export function fillPlatesAndStartRound(state: GameState): GameState {
  const nextState = { ...state };
  nextState.phase = 'drafting';
  nextState.center.hasFirstPlayerTile = true;
  nextState.center.tiles = [];
  nextState.isFirstPlayerClaimedThisRound = false;

  // Add log
  nextState.log = [...nextState.log, `ラウンド ${nextState.round} が開始されました。`];

  // Draw tiles for each plate
  nextState.plates = nextState.plates.map((plate) => {
    let tilesToDraw = 4;
    if (plate.type === 'special_1') {
      tilesToDraw = 5; // Type 1: adds 1 extra tile
    }

    const drawnTiles: TileColor[] = [];
    for (let i = 0; i < tilesToDraw; i++) {
      if (nextState.bag.length === 0) {
        // Refill bag
        if (nextState.discardPile.length > 0) {
          nextState.bag = shuffleArray([...nextState.discardPile]);
          nextState.discardPile = [];
          nextState.log = [...nextState.log, '袋が空になったため、捨て札をシャッフルして袋に戻しました。'];
        } else {
          // No tiles left in bag or discard
          break;
        }
      }
      drawnTiles.push(nextState.bag.pop()!);
    }
    return { ...plate, tiles: drawnTiles };
  });

  // Type 2 special factory logic: Takes matching tile from neighbors
  if (state.variantSpecialFactories) {
    const numPlates = nextState.plates.length;
    nextState.plates = nextState.plates.map((plate, index) => {
      if (plate.type !== 'special_2' || !plate.specialColor) return plate;

      const leftIdx = (index - 1 + numPlates) % numPlates;
      const rightIdx = (index + 1) % numPlates;

      const leftPlate = nextState.plates[leftIdx];
      const rightPlate = nextState.plates[rightIdx];

      const colorToTake = plate.specialColor;
      let tilesTaken = 0;

      // Extract from left
      if (leftPlate.tiles.includes(colorToTake)) {
        leftPlate.tiles = leftPlate.tiles.filter((c) => {
          if (c === colorToTake) {
            tilesTaken++;
            return false;
          }
          return true;
        });
      }

      // Extract from right
      if (rightPlate.tiles.includes(colorToTake)) {
        rightPlate.tiles = rightPlate.tiles.filter((c) => {
          if (c === colorToTake) {
            tilesTaken++;
            return false;
          }
          return true;
        });
      }

      if (tilesTaken > 0) {
        nextState.log = [
          ...nextState.log,
          `特殊工場 ${index + 1} は、隣接する皿から ${colorToTake} を ${tilesTaken} 枚奪いました。`,
        ];
      }

      return {
        ...plate,
        tiles: [...plate.tiles, ...Array(tilesTaken).fill(colorToTake)],
      };
    });
  }

  return nextState;
}

export function getValidRowsForColor(
  board: PlayerBoard,
  color: TileColor,
  variantGrayWall: boolean
): boolean[] {
  const valid = [false, false, false, false, false];

  for (let r = 0; r < 5; r++) {
    const row = board.patternLines[r];
    const wallRow = board.wall[r];

    // Check if color is already in wall
    if (variantGrayWall) {
      // For gray wall, color is already used if any cell in this row has this color placed
      const alreadyInWall = wallRow.some((cell) => cell.placed && cell.color === color);
      if (alreadyInWall) continue;
    } else {
      // For standard wall, find the color cell
      const colorIndex = WALL_LAYOUT[r].indexOf(color);
      if (wallRow[colorIndex].placed) continue;
    }

    // Check pattern line status
    const existingColor = row.find((c) => c !== null);
    const count = row.filter((c) => c !== null).length;

    if (!existingColor) {
      valid[r] = true; // Line is empty
    } else if (existingColor === color && count < r + 1) {
      valid[r] = true; // Line has the same color and is not full
    }
  }

  return valid;
}

export function draftTiles(
  state: GameState,
  source: 'center' | { plateIndex: number },
  color: TileColor,
  targetRowIndex: number | 'floor',
  playerIndex: number
): GameState {
  const nextState = JSON.parse(JSON.stringify(state)) as GameState;
  const player = nextState.players[playerIndex];

  let selectedTilesCount = 0;
  let remainingTiles: TileColor[] = [];
  let sourceName = '';

  // 1. Gather tiles from source
  if (source === 'center') {
    sourceName = '場の中央';
    selectedTilesCount = nextState.center.tiles.filter((t) => t === color).length;
    nextState.center.tiles = nextState.center.tiles.filter((t) => t !== color);

    // First player tile penalty
    if (nextState.center.hasFirstPlayerTile) {
      nextState.center.hasFirstPlayerTile = false;
      nextState.isFirstPlayerClaimedThisRound = true;
      nextState.firstPlayerThisRound = player.id;
      player.floor.push('first');
      nextState.log = [...nextState.log, `${player.name} は、場の中央から最初にタイルを獲得し、1番プレイヤーマーカーを受け取りました。`];
    }
  } else {
    const plate = nextState.plates[source.plateIndex];
    sourceName = `丸皿 ${source.plateIndex + 1}`;
    selectedTilesCount = plate.tiles.filter((t) => t === color).length;
    remainingTiles = plate.tiles.filter((t) => t !== color);
    plate.tiles = [];

    // Apply special plate properties for remaining tiles
    if (state.variantSpecialFactories) {
      if (plate.type === 'special_3') {
        // Special 3: remaining tiles stay on the plate!
        plate.tiles = remainingTiles;
        remainingTiles = [];
        nextState.log = [...nextState.log, `特殊工場 ${source.plateIndex + 1} の他のタイルは皿に残りました。`];
      } else if (plate.type === 'special_4') {
        // Special 4: split between left and right neighbor plates
        const numPlates = nextState.plates.length;
        const leftIdx = (source.plateIndex - 1 + numPlates) % numPlates;
        const rightIdx = (source.plateIndex + 1) % numPlates;

        const leftPlate = nextState.plates[leftIdx];
        const rightPlate = nextState.plates[rightIdx];

        // Unique colors in remaining tiles
        const uniqueColors = Array.from(new Set(remainingTiles));
        uniqueColors.forEach((rc, i) => {
          const colorTiles = remainingTiles.filter((t) => t === rc);
          if (i % 2 === 0) {
            leftPlate.tiles.push(...colorTiles);
            nextState.log = [...nextState.log, `特殊工場 ${source.plateIndex + 1} の ${rc} (${colorTiles.length}枚) は皿 ${leftIdx + 1} に移動しました。`];
          } else {
            rightPlate.tiles.push(...colorTiles);
            nextState.log = [...nextState.log, `特殊工場 ${source.plateIndex + 1} の ${rc} (${colorTiles.length}枚) は皿 ${rightIdx + 1} に移動しました。`];
          }
        });
        remainingTiles = [];
      } else if (plate.type === 'special_5') {
        // Special 5: remaining tiles go to center, plate goes to player's board for penalty buffer!
        // We will track if player has special 5 buffer!
        // Let's store special plate on player floor as a string like 'special_5' or separate flag.
        // Let's add it to floor as a special marker.
        player.floor.push('special_5' as any);
        nextState.log = [...nextState.log, `${player.name} は特殊工場 ${source.plateIndex + 1} の効果でペナルティを1回無効化する皿を獲得しました。`];
      }
    }

    if (remainingTiles.length > 0) {
      nextState.center.tiles.push(...remainingTiles);
    }
  }

  nextState.log = [
    ...nextState.log,
    `${player.name} は ${sourceName} から ${color} を ${selectedTilesCount} 枚獲得しました。`,
  ];

  // 2. Place tiles
  let tilesToPlace = selectedTilesCount;

  if (targetRowIndex === 'floor') {
    // Put all in floor
    for (let i = 0; i < tilesToPlace; i++) {
      if (player.floor.length < 7) {
        // Special 5 plate absorbs penalty!
        const specIndex = player.floor.indexOf('special_5' as any);
        if (specIndex !== -1) {
          player.floor.splice(specIndex, 1); // remove the plate
          nextState.log = [...nextState.log, `ペナルティが特殊工場の皿によって1回無効化されました。`];
          // tile doesn't get placed on floor, but goes to discard!
          nextState.discardPile.push(color);
        } else {
          player.floor.push(color);
        }
      } else {
        // Floor is full, goes to discard
        nextState.discardPile.push(color);
      }
    }
  } else {
    // Put in pattern line
    const row = player.patternLines[targetRowIndex];
    const capacity = targetRowIndex + 1;
    const currentCount = row.filter((t) => t !== null).length;

    const spacesAvailable = capacity - currentCount;
    const tilesToLine = Math.min(tilesToPlace, spacesAvailable);
    const tilesToFloor = tilesToPlace - tilesToLine;

    // Place on line
    for (let i = 0; i < capacity; i++) {
      if (row[i] === null && tilesToPlace > 0) {
        row[i] = color;
        tilesToPlace--;
      }
    }

    // Place excess on floor
    for (let i = 0; i < tilesToFloor; i++) {
      if (player.floor.length < 7) {
        const specIndex = player.floor.indexOf('special_5' as any);
        if (specIndex !== -1) {
          player.floor.splice(specIndex, 1);
          nextState.log = [...nextState.log, `ペナルティが特殊工場の皿によって1回無効化されました。`];
          nextState.discardPile.push(color);
        } else {
          player.floor.push(color);
        }
      } else {
        nextState.discardPile.push(color);
      }
    }
  }

  // Check if drafting is done
  const platesEmpty = nextState.plates.every((p) => p.tiles.length === 0);
  const centerEmpty = nextState.center.tiles.length === 0 && !nextState.center.hasFirstPlayerTile;

  if (platesEmpty && centerEmpty) {
    nextState.phase = 'tiling';
    nextState.log = [...nextState.log, '全てのタイルが獲得されました。壁の装飾フェイズに入ります。'];
    return performTilingAndScoring(nextState);
  } else {
    // Advance turn
    nextState.currentPlayerIndex = (nextState.currentPlayerIndex + 1) % nextState.players.length;
    return nextState;
  }
}

function scoreTilePlacement(
  wall: WallCell[][],
  rowIndex: number,
  colIndex: number
): number {
  let score = 0;

  // Horizontal check
  let hCount = 1;
  // Left
  let c = colIndex - 1;
  while (c >= 0 && wall[rowIndex][c].placed) {
    hCount++;
    c--;
  }
  // Right
  c = colIndex + 1;
  while (c < 5 && wall[rowIndex][c].placed) {
    hCount++;
    c++;
  }

  // Vertical check
  let vCount = 1;
  // Up
  let r = rowIndex - 1;
  while (r >= 0 && wall[r][colIndex].placed) {
    vCount++;
    r--;
  }
  // Down
  r = rowIndex + 1;
  while (r < 5 && wall[r][colIndex].placed) {
    vCount++;
    r++;
  }

  const hScore = hCount > 1 ? hCount : 0;
  const vScore = vCount > 1 ? vCount : 0;

  if (hScore === 0 && vScore === 0) {
    score = 1; // Isolated tile
  } else {
    score = hScore + vScore;
  }

  return score;
}

export function performTilingAndScoring(state: GameState): GameState {
  const nextState = { ...state };

  nextState.players.forEach((player) => {
    let roundPoints = 0;
    nextState.log = [...nextState.log, `--- ${player.name} の装飾と得点 ---`];

    // 1. Tiling and Scoring
    for (let r = 0; r < 5; r++) {
      const line = player.patternLines[r];
      const count = line.filter((t) => t !== null).length;
      const capacity = r + 1;

      if (count === capacity) {
        // Line complete!
        const color = line[0]!;
        let colIndex = -1;

        if (nextState.variantGrayWall) {
          // Gray wall: choose the first empty spot in the row that doesn't violate column color
          // For AI or standard automatic, just pick the first cell that is unplaced and color doesn't conflict
          // Wait, gray wall requires that the wall row/col does not already have this color!
          const validColIndices: number[] = [];
          for (let c = 0; c < 5; c++) {
            if (!player.wall[r][c].placed) {
              // check column c for this color
              let colorConflictInCol = false;
              for (let rCheck = 0; rCheck < 5; rCheck++) {
                if (player.wall[rCheck][c].placed && player.wall[rCheck][c].color === color) {
                  colorConflictInCol = true;
                  break;
                }
              }
              if (!colorConflictInCol) {
                validColIndices.push(c);
              }
            }
          }

          // Pick the first valid column (or let's find the best, but first valid is safe for now, standard Azul says player chooses, let's pick first valid automatically)
          colIndex = validColIndices[0];
        } else {
          // Normal wall
          colIndex = WALL_LAYOUT[r].indexOf(color);
        }

        if (colIndex !== -1) {
          // Place in wall
          player.wall[r][colIndex].placed = true;
          player.wall[r][colIndex].color = color;

          // Score it!
          const points = scoreTilePlacement(player.wall, r, colIndex);
          roundPoints += points;

          // Log it
          nextState.log = [
            ...nextState.log,
            `図案ライン ${r + 1} を完成！ ${color} を壁に配置 (+${points}点)`,
          ];

          // Discard tiles
          // 1 tile goes to the wall, others (capacity - 1) go to discard
          for (let i = 0; i < capacity - 1; i++) {
            nextState.discardPile.push(color);
          }
        } else {
          nextState.log = [
            ...nextState.log,
            `警告: 図案ライン ${r + 1} の ${color} を配置できる壁のスペースがありませんでした！`,
          ];
          // Discard all if couldn't place for some reason
          for (let i = 0; i < capacity; i++) {
            nextState.discardPile.push(color);
          }
        }

        // Clear pattern line
        player.patternLines[r] = Array(capacity).fill(null);
      }
    }

    // 2. Floor line penalties
    let floorPenalty = 0;
    player.floor.forEach((item, index) => {
      const p = FLOOR_PENALTIES[Math.min(index, FLOOR_PENALTIES.length - 1)];
      floorPenalty += p; // p is negative

      if (item !== 'first' && item !== ('special_5' as any)) {
        nextState.discardPile.push(item);
      }
    });

    if (floorPenalty < 0) {
      nextState.log = [...nextState.log, `床ラインのペナルティ: ${floorPenalty}点`];
    }

    // Apply round points and floor penalty
    player.score = Math.max(0, player.score + roundPoints + floorPenalty);
    nextState.log = [...nextState.log, `${player.name} の現在の得点: ${player.score}点`];

    // Clear floor line
    player.floor = [];
  });

  // Check if game is over (any player has a horizontal row completed)
  let isGameOver = false;
  nextState.players.forEach((player) => {
    for (let r = 0; r < 5; r++) {
      let rowComplete = true;
      for (let c = 0; c < 5; c++) {
        if (!player.wall[r][c].placed) {
          rowComplete = false;
          break;
        }
      }
      if (rowComplete) {
        isGameOver = true;
        break;
      }
    }
  });

  if (isGameOver) {
    nextState.phase = 'scoring';
    nextState.log = [...nextState.log, 'いずれかのプレイヤーが壁を横一列完成させたため、ゲームが終了しました！最終得点計算を行います。'];
    return calculateFinalScoring(nextState);
  } else {
    // Next round setup
    nextState.phase = 'setup';
    nextState.round++;

    // Determine starting player
    let nextStartPlayerId = nextState.firstPlayerThisRound;
    if (!nextStartPlayerId) {
      // If no one took the first player marker (should be impossible in standard, but for safety)
      nextStartPlayerId = nextState.players[nextState.currentPlayerIndex].id;
    }

    const nextStartPlayerIndex = nextState.players.findIndex((p) => p.id === nextStartPlayerId);
    nextState.currentPlayerIndex = nextStartPlayerIndex !== -1 ? nextStartPlayerIndex : 0;

    nextState.firstPlayerThisRound = null;
    nextState.log = [
      ...nextState.log,
      `次のラウンドのスタートプレイヤーは ${nextState.players[nextState.currentPlayerIndex].name} です。`,
    ];

    return fillPlatesAndStartRound(nextState);
  }
}

export function calculateFinalScoring(state: GameState): GameState {
  const nextState = { ...state };
  nextState.phase = 'game_over';

  let maxScore = -1;
  let maxHorizontalRows = -1;
  let winners: string[] = [];

  nextState.players.forEach((player) => {
    nextState.log = [...nextState.log, `=== ${player.name} の最終ボーナス計算 ===`];
    let horizontalBonus = 0;
    let verticalBonus = 0;
    let colorBonus = 0;

    // 1. Horizontal Rows (+2 each)
    let horizCount = 0;
    for (let r = 0; r < 5; r++) {
      let complete = true;
      for (let c = 0; c < 5; c++) {
        if (!player.wall[r][c].placed) complete = false;
      }
      if (complete) horizCount++;
    }
    horizontalBonus = horizCount * 2;
    player.completedHorizontalRows = horizCount;
    if (horizCount > 0) {
      nextState.log = [...nextState.log, `横 ${horizCount} 列完成: +${horizontalBonus}点`];
    }

    // 2. Vertical Rows (+7 each)
    let vertCount = 0;
    for (let c = 0; c < 5; c++) {
      let complete = true;
      for (let r = 0; r < 5; r++) {
        if (!player.wall[r][c].placed) complete = false;
      }
      if (complete) vertCount++;
    }
    verticalBonus = vertCount * 7;
    player.completedVerticalRows = vertCount;
    if (vertCount > 0) {
      nextState.log = [...nextState.log, `縦 ${vertCount} 列完成: +${verticalBonus}点`];
    }

    // 3. Complete Colors (+10 each)
    const colors: TileColor[] = ['blue', 'yellow', 'red', 'black', 'cyan'];
    let colorCount = 0;
    colors.forEach((color) => {
      let count = 0;
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 5; c++) {
          if (player.wall[r][c].placed && player.wall[r][c].color === color) {
            count++;
          }
        }
      }
      if (count === 5) colorCount++;
    });
    colorBonus = colorCount * 10;
    player.completedColors = colorCount;
    if (colorCount > 0) {
      nextState.log = [...nextState.log, `全 ${colorCount} 色コンプリート: +${colorBonus}点`];
    }

    player.score += horizontalBonus + verticalBonus + colorBonus;
    nextState.log = [...nextState.log, `${player.name} の最終得点: ${player.score}点`];

    // Tie-breaking: score, then horizontal rows
    if (player.score > maxScore) {
      maxScore = player.score;
      maxHorizontalRows = player.completedHorizontalRows;
      winners = [player.id];
    } else if (player.score === maxScore) {
      if (player.completedHorizontalRows > maxHorizontalRows) {
        maxHorizontalRows = player.completedHorizontalRows;
        winners = [player.id];
      } else if (player.completedHorizontalRows === maxHorizontalRows) {
        winners.push(player.id);
      }
    }
  });

  nextState.winnerIds = winners;
  const winnerNames = nextState.players
    .filter((p) => winners.includes(p.id))
    .map((p) => p.name)
    .join(', ');
  nextState.log = [...nextState.log, `🏆 ゲーム終了！勝者は ${winnerNames} です！ 得点: ${maxScore}点`];

  return nextState;
}

// Old AI moved to src/utils/aiEngine.ts with Easy/Normal/Hard difficulty levels
