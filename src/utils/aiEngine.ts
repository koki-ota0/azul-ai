/**
 * AI Engine for Azul with Reinforcement Learning
 * 
 * Strategic Principles (戦略原則):
 * 1. 序盤は多く取る - 3個一気に取れるならそれを優先
 * 2. 2列目は2個、3列目は3個で1回完成が理想
 * 3. 4-5列目は2回で完成が理想、1個だけ置くのは悪手
 * 4. 1個だけの配置は床の方がマシな場合が多い（特に大きい列）
 * 5. 色の分散は絶対に避ける - 同じ色を複数行に置かない
 * 6. 縦列（特に中央）を優先
 * 7. 相手の妨害と先手の価値
 * 8. ターン終了時の悪い状態を避ける:
 *    - 2,3列目が中途半端(1枚以上で未完成)
 *    - 4,5列目が3マス以上空き
 * 9. 置ける場所があるなら絶対にフロアに置かない
 */

import {
  GameState,
  PlayerBoard,
  TileColor,
  WallCell,
} from '../types/game';
import { WALL_LAYOUT, getValidRowsForColor } from './gameEngine';
import pretrainedCheckpoint from '../data/pretrainedWeights.json';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface AIMove {
  source: 'center' | { plateIndex: number };
  color: TileColor;
  targetRowIndex: number | 'floor';
}

interface ScoredMove extends AIMove {
  score: number;
}

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const FLOOR_PENALTIES = [-1, -1, -2, -2, -2, -3, -3];
const ALL_COLORS: TileColor[] = ['red', 'blue', 'yellow', 'black', 'cyan'];
const COLUMN_WEIGHTS = [1.0, 1.3, 1.6, 1.3, 1.0];

// 1個だけ置くペナルティ (rowIndex -> penalty)
const SINGLE_TILE_PENALTY: number[] = [
  0,    // Row 0: 1個で完成なのでOK
  -5,   // Row 1: 1個だけは微妙（次に1個必要だが中途半端）
  -10,  // Row 2: 1個だけは悪い（次に2個必要）
  -20,  // Row 3: 1個だけは非常に悪い（次に3個必要）
  -30,  // Row 4: 1個だけは最悪（次に4個必要）
];

// Completing a large pattern line converts many tiles into an immediate wall
// placement and avoids locking a scarce colour into a long unfinished line.
const LINE_COMPLETION_PRIORITY = [0, 10, 25, 70, 110];

// ターン終了時の悪い状態ペナルティ
// 2,3列目に中途半端に置いてある = 悪い
// 4,5列目に3マス以上空きがある = 悪い
const BAD_STATE_PENALTIES = {
  ROW_1_PARTIAL: -15,  // 2列目に1個だけ
  ROW_2_PARTIAL: -20,  // 3列目に1-2個
  ROW_3_MOSTLY_EMPTY: -25, // 4列目に0-1個 (3マス以上空き)
  ROW_4_MOSTLY_EMPTY: -35, // 5列目に0-2個 (3マス以上空き)
};

const NUM_FEATURES = 80;

// ─────────────────────────────────────────────
// Pre-trained weights
// ─────────────────────────────────────────────

const SEED_WEIGHTS: number[] = [
  // [0] current score
   1.20,
  // [1] opponent best score
  -0.95,
  // [2] score differential
   0.90,
  // [3..7] vertical column progress
   2.20, 3.00, 3.80, 3.00, 2.20,
  // [8..12] vertical near-complete
   8.00, 11.00, 14.00, 11.00, 8.00,
  // [13..17] horizontal row progress
   0.70, 0.75, 0.80, 0.85, 0.90,
  // [18..22] horizontal near-complete
   2.50, 2.70, 2.90, 3.10, 3.30,
  // [23..27] color completion progress
   1.60, 1.60, 1.60, 1.60, 1.60,
  // [28..32] color near-complete
   6.50, 6.50, 6.50, 6.50, 6.50,
  // [33] floor penalty
   2.80,
  // [34] total wall tiles
   0.55,
  // [35] wall adjacency
   0.70,
  // [36..40] pattern fill ratio
   0.50, 0.70, 1.00, 0.90, 0.75,
  // [41..45] inflexibility (1-2 tiles in big rows)
  -0.20, -0.50, -3.00, -8.00, -15.00,
  // [46..50] near-complete
   2.50, 3.00, 4.00, 5.00, 6.00,
  // [51] color focus bonus
   5.50,
  // [52] color scatter penalty
  -10.00,
  // [53..55] first player value
   5.00, 3.00, 7.00,
  // [56] opponent denial
   2.50,
  // [57] giving opponents tiles
  -3.00,
  // [58] completable lines
   2.50,
  // [59] flexibility
   0.20,
  // [60] endgame urgency
   6.00,
  // [61] floor risk
  -4.00,
  // [62] tiles taken bonus
   2.00,
  // [63] perfect fill bonus
   6.00,
  // [64..68] single tile penalty per row
  -1.00, -5.00, -10.00, -20.00, -30.00,
  // [69..73] ideal fill match
   2.50, 5.00, 7.00, 6.00, 5.50,
  // [74] early game aggression
   3.00,
  // NEW: [75..79] bad state penalties
  -15.00, // row 1 partial (2列目中途半端)
  -20.00, // row 2 partial (3列目中途半端)
  -25.00, // row 3 mostly empty (4列目ほぼ空)
  -35.00, // row 4 mostly empty (5列目ほぼ空)
  -50.00, // floor when could place (置けるのにフロア)
];

/**
 * Offline self-play checkpoint.  Keeping this in the bundle means a fresh
 * browser starts from the trained policy instead of from hand-tuned weights.
 * The runtime trainer can still refine it and stores those refinements in
 * localStorage.
 */
const PRETRAINED_WEIGHTS: number[] = pretrainedCheckpoint.weights.length === NUM_FEATURES
  ? [...pretrainedCheckpoint.weights]
  : SEED_WEIGHTS;
const PRETRAINED_TRAINING_COUNT = pretrainedCheckpoint.trainingCount;

// ─────────────────────────────────────────────
// RL Weight Manager
// ─────────────────────────────────────────────

const STORAGE_KEY = 'azul_rl_weights_v5';
const TRAINING_COUNT_KEY = 'azul_rl_training_count_v5';

let currentWeights: number[] = [...PRETRAINED_WEIGHTS];
let trainingCount = 0;
const humanTrajectory: { features: number[]; playerIndex: number }[] = [];

function loadWeights(): void {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const count = localStorage.getItem(TRAINING_COUNT_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as number[];
      if (parsed.length === NUM_FEATURES) {
        currentWeights = parsed;
        trainingCount = count ? parseInt(count, 10) : 0;
        return;
      }
    }
  } catch (_e) { /* ignore */ }
  currentWeights = [...PRETRAINED_WEIGHTS];
  trainingCount = PRETRAINED_TRAINING_COUNT;
}

function saveWeights(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(currentWeights));
    localStorage.setItem(TRAINING_COUNT_KEY, trainingCount.toString());
  } catch (_e) { /* ignore */ }
}

export function resetWeights(): void {
  currentWeights = [...PRETRAINED_WEIGHTS];
  trainingCount = PRETRAINED_TRAINING_COUNT;
  saveWeights();
}

export function getTrainingInfo(): { count: number; weights: number[] } {
  return { count: trainingCount, weights: [...currentWeights] };
}

/** Save the position immediately before a human makes a decision. */
export function recordHumanDecision(state: GameState, playerIndex: number): void {
  humanTrajectory.push({ features: extractFeatures(state, playerIndex), playerIndex });
}

/**
 * Learn from a completed human game. Human wins receive a much stronger
 * terminal signal so the value function preserves successful human strategy.
 */
export function learnFromHumanGame(finalState: GameState): void {
  if (humanTrajectory.length === 0) return;

  const totalSteps = humanTrajectory.length;
  for (let t = 0; t < totalSteps; t++) {
    const { features, playerIndex } = humanTrajectory[t];
    const player = finalState.players[playerIndex];
    const opponentBest = Math.max(
      0,
      ...finalState.players.filter((_, i) => i !== playerIndex).map(p => p.score),
    );
    const won = finalState.winnerIds.includes(player.id);
    const terminalValue = (player.score - opponentBest * 0.6) / 10;
    const target = terminalValue * Math.pow(GAMMA, totalSteps - t - 1);
    const importance = won ? 6 : 0.5;
    const error = target - evaluateWithWeights(features, currentWeights);
    for (let i = 0; i < NUM_FEATURES; i++) {
      currentWeights[i] += LR * importance * error * features[i];
    }
  }

  humanTrajectory.length = 0;
  trainingCount++;
  saveWeights();
}

export function clearHumanTrajectory(): void {
  humanTrajectory.length = 0;
}

export function exportWeights(): string {
  return JSON.stringify({
    version: 5,
    features: NUM_FEATURES,
    trainingCount,
    weights: currentWeights,
    exportedAt: new Date().toISOString(),
  }, null, 2);
}

export function importWeights(json: string): { success: boolean; message: string } {
  try {
    const data = JSON.parse(json);
    if (!data.weights || !Array.isArray(data.weights)) {
      return { success: false, message: '無効なフォーマット' };
    }
    if (data.weights.length !== NUM_FEATURES) {
      return { success: false, message: `特徴量数不一致 (期待:${NUM_FEATURES}, 実際:${data.weights.length})` };
    }
    currentWeights = data.weights;
    trainingCount = data.trainingCount || 0;
    saveWeights();
    return { success: true, message: `インポート成功! ${trainingCount.toLocaleString()}局` };
  } catch (e) {
    return { success: false, message: `パースエラー: ${e}` };
  }
}

loadWeights();

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function countRemainingTiles(state: GameState): number {
  let c = 0;
  for (const p of state.plates) c += p.tiles.length;
  return c + state.center.tiles.length;
}

function isEndgame(state: GameState): boolean {
  for (const p of state.players) {
    for (let r = 0; r < 5; r++) {
      if (p.wall[r].filter((c) => c.placed).length >= 4) return true;
    }
  }
  return state.round >= 4;
}

function getRoundProgress(state: GameState): number {
  const total = countRemainingTiles(state);
  const init = state.plates.length * 4;
  return 1 - total / Math.max(init, 1);
}

function isEarlyGame(state: GameState): boolean {
  return state.round <= 2 && getRoundProgress(state) < 0.5;
}

// Check which row already has this color in pattern line
function getRowWithColor(player: PlayerBoard, color: TileColor): number {
  for (let r = 0; r < 5; r++) {
    if (player.patternLines[r].some(t => t === color)) {
      return r;
    }
  }
  return -1;
}

// ─────────────────────────────────────────────
// Feature extraction
// ─────────────────────────────────────────────

function extractFeatures(state: GameState, playerIndex: number): number[] {
  const f = new Array(NUM_FEATURES).fill(0);
  const player = state.players[playerIndex];

  let bestOppScore = 0;
  for (let i = 0; i < state.players.length; i++) {
    if (i !== playerIndex && state.players[i].score > bestOppScore) {
      bestOppScore = state.players[i].score;
    }
  }

  f[0] = player.score / 100;
  f[1] = bestOppScore / 100;
  f[2] = (player.score - bestOppScore) / 100;

  // Vertical columns
  for (let c = 0; c < 5; c++) {
    let placed = 0;
    for (let r = 0; r < 5; r++) {
      if (player.wall[r][c].placed) placed++;
    }
    f[3 + c] = placed / 5;
    f[8 + c] = placed >= 4 ? 1 : 0;
  }

  // Horizontal rows
  for (let r = 0; r < 5; r++) {
    const placed = player.wall[r].filter((c) => c.placed).length;
    f[13 + r] = placed / 5;
    f[18 + r] = placed >= 4 ? 1 : 0;
  }

  // Colors
  for (let ci = 0; ci < 5; ci++) {
    const color = ALL_COLORS[ci];
    let count = 0;
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        if (player.wall[r][c].placed && player.wall[r][c].color === color) count++;
      }
    }
    f[23 + ci] = count / 5;
    f[28 + ci] = count >= 4 ? 1 : 0;
  }

  // Floor
  let floorPen = 0;
  for (let i = 0; i < player.floor.length; i++) {
    floorPen += FLOOR_PENALTIES[Math.min(i, 6)];
  }
  f[33] = floorPen / 14;

  // Wall tiles
  let totalWall = 0;
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      if (player.wall[r][c].placed) totalWall++;
    }
  }
  f[34] = totalWall / 25;

  // Adjacency
  let adj = 0;
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      if (!player.wall[r][c].placed) continue;
      if (r > 0 && player.wall[r - 1][c].placed) adj++;
      if (c > 0 && player.wall[r][c - 1].placed) adj++;
    }
  }
  f[35] = adj / 40;

  // Pattern lines
  for (let r = 0; r < 5; r++) {
    const cap = r + 1;
    const cnt = player.patternLines[r].filter((t) => t !== null).length;
    f[36 + r] = cnt / cap;
    if (cnt > 0 && cnt < cap && cap >= 3 && cnt <= Math.floor(cap / 2)) {
      f[41 + r] = (cap - cnt) / cap;
    }
    f[46 + r] = (cnt === cap - 1 && cnt > 0) ? 1 : 0;
  }

  // Color focus/scatter
  let focusBonus = 0;
  let scatterPenalty = 0;
  for (const color of ALL_COLORS) {
    let linesWithColor = 0;
    let wallCount = 0;
    for (let r = 0; r < 5; r++) {
      if (player.patternLines[r].some((t) => t === color)) linesWithColor++;
      for (let c = 0; c < 5; c++) {
        if (player.wall[r][c].placed && player.wall[r][c].color === color) wallCount++;
      }
    }
    if (linesWithColor === 1 && wallCount >= 1) focusBonus += wallCount;
    if (linesWithColor >= 2) scatterPenalty += (linesWithColor - 1) * 2; // Increased penalty
  }
  f[51] = focusBonus / 10;
  f[52] = scatterPenalty / 5;

  // First player
  const roundProg = getRoundProgress(state);
  const eg = isEndgame(state);
  f[53] = (!state.isFirstPlayerClaimedThisRound && roundProg < 0.3) ? 1 : 0;
  f[54] = (!state.isFirstPlayerClaimedThisRound && roundProg >= 0.3 && !eg) ? 1 : 0;
  f[55] = (!state.isFirstPlayerClaimedThisRound && eg) ? 1 : 0;

  // Opponent denial
  let deny = 0;
  for (let i = 0; i < state.players.length; i++) {
    if (i === playerIndex) continue;
    for (let r = 0; r < 5; r++) {
      const line = state.players[i].patternLines[r];
      const cnt = line.filter((t) => t !== null).length;
      if (cnt > 0 && cnt === r) deny++;
    }
  }
  f[56] = deny / 10;
  f[57] = 0;

  // Completable
  let completable = 0;
  for (let r = 0; r < 5; r++) {
    const cnt = player.patternLines[r].filter((t) => t !== null).length;
    if (cnt === r && cnt > 0) completable++;
  }
  f[58] = completable / 5;

  // Flexibility
  let valid = 0;
  for (const color of ALL_COLORS) {
    valid += getValidRowsForColor(player, color, state.variantGrayWall).filter(Boolean).length;
  }
  f[59] = valid / 25;

  // Endgame urgency
  let close = 0;
  for (let r = 0; r < 5; r++) {
    if (player.wall[r].filter((c) => c.placed).length >= 4) close++;
  }
  f[60] = close;

  // Floor risk
  f[61] = player.floor.length / 7;

  // Early game
  f[74] = state.round <= 2 ? 1 : 0;

  // Bad state features [75..78]
  // Row 1 (2列目) partial: has 1 tile but not complete
  const row1cnt = player.patternLines[1].filter(t => t !== null).length;
  f[75] = (row1cnt === 1) ? 1 : 0;
  
  // Row 2 (3列目) partial: has 1-2 tiles but not complete
  const row2cnt = player.patternLines[2].filter(t => t !== null).length;
  f[76] = (row2cnt >= 1 && row2cnt <= 2) ? 1 : 0;
  
  // Row 3 (4列目) mostly empty: 0-1 tiles (3+ spaces left)
  const row3cnt = player.patternLines[3].filter(t => t !== null).length;
  f[77] = (row3cnt <= 1) ? 1 : 0;
  
  // Row 4 (5列目) mostly empty: 0-2 tiles (3+ spaces left)
  const row4cnt = player.patternLines[4].filter(t => t !== null).length;
  f[78] = (row4cnt <= 2) ? 1 : 0;

  f[79] = 0; // floor when could place - move specific

  return f;
}

// ─────────────────────────────────────────────
// Value function
// ─────────────────────────────────────────────

function evaluateWithWeights(features: number[], weights: number[]): number {
  let sum = 0;
  for (let i = 0; i < NUM_FEATURES; i++) {
    sum += features[i] * weights[i];
  }
  return sum;
}

function evaluateState(state: GameState, playerIndex: number): number {
  return evaluateWithWeights(extractFeatures(state, playerIndex), currentWeights);
}

function evaluateRelative(state: GameState, playerIndex: number): number {
  const my = evaluateState(state, playerIndex);
  let best = -Infinity;
  for (let i = 0; i < state.players.length; i++) {
    if (i !== playerIndex) {
      const e = evaluateState(state, i);
      if (e > best) best = e;
    }
  }
  return my - best * 0.6;
}

// ─────────────────────────────────────────────
// Move generation
// ─────────────────────────────────────────────

function generateAllMoves(state: GameState, playerIndex: number): AIMove[] {
  const player = state.players[playerIndex];
  const moves: AIMove[] = [];

  const add = (src: 'center' | { plateIndex: number }, tiles: TileColor[]) => {
    if (tiles.length === 0) return;
    const unique = Array.from(new Set(tiles));
    for (const color of unique) {
      const valid = getValidRowsForColor(player, color, state.variantGrayWall);
      for (let r = 0; r < 5; r++) {
        if (valid[r]) moves.push({ source: src, color, targetRowIndex: r });
      }
      moves.push({ source: src, color, targetRowIndex: 'floor' });
    }
  };

  for (let i = 0; i < state.plates.length; i++) {
    if (state.plates[i].tiles.length > 0) add({ plateIndex: i }, state.plates[i].tiles);
  }
  if (state.center.tiles.length > 0) add('center', state.center.tiles);

  return moves;
}

// ─────────────────────────────────────────────
// Simulation
// ─────────────────────────────────────────────

function cloneState(s: GameState): GameState {
  return JSON.parse(JSON.stringify(s));
}

function simulateDraft(state: GameState, move: AIMove, pi: number): GameState {
  const s = cloneState(state);
  const p = s.players[pi];
  let count = 0;

  if (move.source === 'center') {
    count = s.center.tiles.filter((t) => t === move.color).length;
    s.center.tiles = s.center.tiles.filter((t) => t !== move.color);
    if (s.center.hasFirstPlayerTile) {
      s.center.hasFirstPlayerTile = false;
      s.firstPlayerThisRound = p.id;
      s.isFirstPlayerClaimedThisRound = true;
      p.floor.push('first');
    }
  } else {
    const pl = s.plates[move.source.plateIndex];
    count = pl.tiles.filter((t) => t === move.color).length;
    const rem = pl.tiles.filter((t) => t !== move.color);
    pl.tiles = [];
    s.center.tiles.push(...rem);
  }

  if (move.targetRowIndex === 'floor') {
    for (let i = 0; i < count; i++) {
      if (p.floor.length < 7) p.floor.push(move.color);
      else s.discardPile.push(move.color);
    }
  } else {
    const row = p.patternLines[move.targetRowIndex];
    const cap = move.targetRowIndex + 1;
    const cur = row.filter((t) => t !== null).length;
    const toLine = Math.min(count, cap - cur);
    const toFloor = count - toLine;
    let placed = 0;
    for (let i = 0; i < cap && placed < toLine; i++) {
      if (row[i] === null) { row[i] = move.color; placed++; }
    }
    for (let i = 0; i < toFloor; i++) {
      if (p.floor.length < 7) p.floor.push(move.color);
      else s.discardPile.push(move.color);
    }
  }

  const empty = s.plates.every((pl) => pl.tiles.length === 0);
  const cEmpty = s.center.tiles.length === 0 && !s.center.hasFirstPlayerTile;
  if (empty && cEmpty) {
    s.phase = 'tiling';
    simTiling(s);
  } else {
    s.currentPlayerIndex = (s.currentPlayerIndex + 1) % s.players.length;
  }
  return s;
}

function scoreWall(wall: WallCell[][], r: number, c: number): number {
  let h = 1, v = 1;
  let cc = c - 1;
  while (cc >= 0 && wall[r][cc].placed) { h++; cc--; }
  cc = c + 1;
  while (cc < 5 && wall[r][cc].placed) { h++; cc++; }
  let rr = r - 1;
  while (rr >= 0 && wall[rr][c].placed) { v++; rr--; }
  rr = r + 1;
  while (rr < 5 && wall[rr][c].placed) { v++; rr++; }
  const hh = h > 1 ? h : 0;
  const vv = v > 1 ? v : 0;
  return hh === 0 && vv === 0 ? 1 : hh + vv;
}

function calcBonus(p: PlayerBoard): number {
  let b = 0;
  for (let r = 0; r < 5; r++) if (p.wall[r].every((c) => c.placed)) b += 2;
  for (let c = 0; c < 5; c++) {
    let ok = true;
    for (let r = 0; r < 5; r++) if (!p.wall[r][c].placed) ok = false;
    if (ok) b += 7;
  }
  for (const col of ALL_COLORS) {
    let cnt = 0;
    for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) {
      if (p.wall[r][c].placed && p.wall[r][c].color === col) cnt++;
    }
    if (cnt === 5) b += 10;
  }
  return b;
}

function simTiling(s: GameState): void {
  for (const p of s.players) {
    let pts = 0;
    for (let r = 0; r < 5; r++) {
      const line = p.patternLines[r];
      const cap = r + 1;
      const cnt = line.filter((t) => t !== null).length;
      if (cnt === cap) {
        const col = line[0]!;
        let ci = -1;
        if (s.variantGrayWall) {
          let best = -1;
          for (let c = 0; c < 5; c++) {
            if (p.wall[r][c].placed) continue;
            let conflict = false;
            for (let rr = 0; rr < 5; rr++) {
              if (p.wall[rr][c].placed && p.wall[rr][c].color === col) { conflict = true; break; }
            }
            if (conflict) continue;
            p.wall[r][c].placed = true;
            p.wall[r][c].color = col;
            const sc = scoreWall(p.wall, r, c) * COLUMN_WEIGHTS[c];
            p.wall[r][c].placed = false;
            if (sc > best) { best = sc; ci = c; }
          }
        } else {
          ci = WALL_LAYOUT[r].indexOf(col);
        }
        if (ci !== -1 && !p.wall[r][ci].placed) {
          p.wall[r][ci].placed = true;
          p.wall[r][ci].color = col;
          pts += scoreWall(p.wall, r, ci);
          for (let i = 0; i < cap - 1; i++) s.discardPile.push(col);
        } else {
          for (let i = 0; i < cap; i++) s.discardPile.push(col);
        }
        p.patternLines[r] = Array(cap).fill(null);
      }
    }
    let pen = 0;
    p.floor.forEach((it, i) => {
      pen += FLOOR_PENALTIES[Math.min(i, 6)];
      if (it !== 'first') s.discardPile.push(it as TileColor);
    });
    p.score = Math.max(0, p.score + pts + pen);
    p.floor = [];
  }
  let over = false;
  for (const p of s.players) {
    for (let r = 0; r < 5; r++) if (p.wall[r].every((c) => c.placed)) { over = true; break; }
    if (over) break;
  }
  if (over) {
    s.phase = 'game_over';
    for (const p of s.players) p.score += calcBonus(p);
  } else {
    s.phase = 'drafting';
    s.round++;
  }
}

// ─────────────────────────────────────────────
// Quick Move Evaluator
// ─────────────────────────────────────────────

function quickEvalMove(state: GameState, move: AIMove, pi: number): number {
  const player = state.players[pi];
  let score = 0;

  // Count tiles
  let colorCount = 0;
  let remaining: TileColor[] = [];
  if (move.source === 'center') {
    colorCount = state.center.tiles.filter((t) => t === move.color).length;
  } else {
    const plate = state.plates[move.source.plateIndex];
    colorCount = plate.tiles.filter((t) => t === move.color).length;
    remaining = plate.tiles.filter((t) => t !== move.color);
  }

  const early = isEarlyGame(state);
  
  // ═══════════════════════════════════════════
  // Floor is normally undesirable, but it remains a legal strategic choice.
  // In particular, putting a single tile into a new fifth line locks that
  // colour for several turns; a small floor penalty can be the better move.
  // ═══════════════════════════════════════════
  if (move.targetRowIndex === 'floor') {
    // Calculate the actual penalty instead of ruling the move out. This lets
    // the evaluator compare an intentional floor placement with a harmful
    // singleton in a long pattern line.
    let fIdx = player.floor.length;
    if (move.source === 'center' && state.center.hasFirstPlayerTile) fIdx++;
    let pen = 0;
    for (let i = 0; i < colorCount; i++) {
      pen += FLOOR_PENALTIES[Math.min(fIdx, 6)];
      fIdx++;
    }
    return pen * 2.5 - 30;
  }

  const rowIndex = move.targetRowIndex;
  const capacity = rowIndex + 1;
  const currentCount = player.patternLines[rowIndex].filter((t) => t !== null).length;
  const spacesLeft = capacity - currentCount;
  const toLine = Math.min(colorCount, spacesLeft);
  const toFloor = colorCount - toLine;
  const newCount = currentCount + toLine;
  const willComplete = newCount === capacity;

  // ═══════════════════════════════════════════
  // CRITICAL: Color consistency - don't scatter!
  // ═══════════════════════════════════════════
  const existingRow = getRowWithColor(player, move.color);
  if (existingRow !== -1 && existingRow !== rowIndex) {
    // This color is already in another row - VERY BAD to place elsewhere
    score -= 100; // Severe penalty
  }
  
  // Also check if we're starting a new color when same color exists elsewhere
  if (currentCount === 0) {
    // Starting fresh - but if this color exists in another partial row, bad!
    for (let r = 0; r < 5; r++) {
      if (r === rowIndex) continue;
      const rowTiles = player.patternLines[r].filter(t => t !== null);
      if (rowTiles.length > 0 && rowTiles[0] === move.color) {
        score -= 80; // Don't start same color in new row
      }
    }
  }

  // ═══════════════════════════════════════════
  // Early game: prefer taking more tiles
  // ═══════════════════════════════════════════
  if (early) {
    score += colorCount * 3;
    if (colorCount >= 3) score += 8;
  }

  // ═══════════════════════════════════════════
  // Single tile placement penalty
  // ═══════════════════════════════════════════
  if (currentCount === 0 && toLine === 1 && capacity >= 2) {
    score += SINGLE_TILE_PENALTY[rowIndex];
    if (early && rowIndex >= 3) {
      score -= 15; // Extra penalty in early game for big rows
    }
    if (rowIndex === 4) score -= 45;
  }

  // ═══════════════════════════════════════════
  // Ideal fill patterns
  // ═══════════════════════════════════════════
  if (currentCount === 0) {
    // Perfect fills: 2 in row 1, 3 in row 2, etc.
    if (rowIndex === 0 && toLine === 1) score += 5;
    else if (rowIndex === 1 && toLine === 2) score += 10;
    else if (rowIndex === 2 && toLine === 3) score += 15;
    else if (rowIndex === 3 && (toLine === 2 || toLine === 4)) score += 12;
    else if (rowIndex === 4 && (toLine === 3 || toLine === 2 || toLine === 5)) score += 10;
  }

  // ═══════════════════════════════════════════
  // Bad state after this move (turn end state)
  // ═══════════════════════════════════════════
  // Predict state after move and penalize bad patterns
  
  // Row 1 (2列目): 1 tile partial is bad
  if (rowIndex === 1 && newCount === 1) {
    score += BAD_STATE_PENALTIES.ROW_1_PARTIAL;
  }
  
  // Row 2 (3列目): 1-2 tiles partial is bad  
  if (rowIndex === 2 && newCount >= 1 && newCount <= 2) {
    score += BAD_STATE_PENALTIES.ROW_2_PARTIAL;
  }
  
  // Row 3 (4列目): 0-1 tiles (3+ spaces) is bad
  if (rowIndex === 3 && newCount <= 1) {
    score += BAD_STATE_PENALTIES.ROW_3_MOSTLY_EMPTY;
  }
  
  // Row 4 (5列目): 0-2 tiles (3+ spaces) is bad
  if (rowIndex === 4 && newCount <= 2) {
    score += BAD_STATE_PENALTIES.ROW_4_MOSTLY_EMPTY;
  }

  // ═══════════════════════════════════════════
  // Completion scoring
  // ═══════════════════════════════════════════
  if (willComplete) {
    score += LINE_COMPLETION_PRIORITY[rowIndex];
    let colIndex = state.variantGrayWall
      ? findBestCol(player.wall, rowIndex, move.color)
      : WALL_LAYOUT[rowIndex].indexOf(move.color);

    if (colIndex !== -1 && !player.wall[rowIndex][colIndex].placed) {
      player.wall[rowIndex][colIndex].placed = true;
      player.wall[rowIndex][colIndex].color = move.color;
      const pts = scoreWall(player.wall, rowIndex, colIndex);

      let colPlaced = 0;
      for (let r = 0; r < 5; r++) if (player.wall[r][colIndex].placed) colPlaced++;
      const cw = COLUMN_WEIGHTS[colIndex];
      score += pts * 5;
      score += colPlaced * 4 * cw;
      if (colPlaced === 5) score += 35 * cw;
      else if (colPlaced === 4) score += 18 * cw;
      else if (colPlaced === 3) score += 8 * cw;

      const rowPlaced = player.wall[rowIndex].filter((c) => c.placed).length;
      if (rowPlaced === 5) score += 12;
      else if (rowPlaced === 4) score += 6;

      let colorPlaced = 0;
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 5; c++) {
          if (player.wall[r][c].placed && player.wall[r][c].color === move.color) colorPlaced++;
        }
      }
      if (colorPlaced === 5) score += 22;
      else if (colorPlaced === 4) score += 14;
      else if (colorPlaced >= 3) score += 6;

      player.wall[rowIndex][colIndex].placed = false;
    }
  } else {
    // Partial fill
    const progress = newCount / capacity;

    let colIndex = state.variantGrayWall
      ? findBestCol(player.wall, rowIndex, move.color)
      : WALL_LAYOUT[rowIndex].indexOf(move.color);

    if (colIndex !== -1) {
      let adj = 0;
      if (rowIndex > 0 && player.wall[rowIndex - 1][colIndex].placed) adj++;
      if (rowIndex < 4 && player.wall[rowIndex + 1][colIndex].placed) adj++;
      if (colIndex > 0 && player.wall[rowIndex][colIndex - 1].placed) adj++;
      if (colIndex < 4 && player.wall[rowIndex][colIndex + 1].placed) adj++;
      score += adj * 6;

      let colPlaced = 0;
      for (let r = 0; r < 5; r++) if (player.wall[r][colIndex].placed) colPlaced++;
      score += colPlaced * 3.5 * COLUMN_WEIGHTS[colIndex];
    }

    score += progress * 15 + rowIndex;
    if (spacesLeft - toLine === 1) score += 12; // Near complete setup
  }

  // ═══════════════════════════════════════════
  // Floor overflow penalty
  // ═══════════════════════════════════════════
  if (toFloor > 0) {
    let fIdx = player.floor.length;
    if (move.source === 'center' && state.center.hasFirstPlayerTile) fIdx++;
    for (let i = 0; i < toFloor; i++) {
      score += FLOOR_PENALTIES[Math.min(fIdx, 6)] * 3.5;
      fIdx++;
    }
  }

  // ═══════════════════════════════════════════
  // First player value
  // ═══════════════════════════════════════════
  if (move.source === 'center' && state.center.hasFirstPlayerTile) {
    const fIdx = player.floor.length;
    score += FLOOR_PENALTIES[Math.min(fIdx, 6)];
    const rp = getRoundProgress(state);
    const eg = isEndgame(state);
    if (eg) score += 8;
    else if (rp < 0.3) score += 6;
    else score += 3.5;
  }

  // ═══════════════════════════════════════════
  // Opponent denial
  // ═══════════════════════════════════════════
  for (let i = 0; i < state.players.length; i++) {
    if (i === pi) continue;
    const opp = state.players[i];
    for (let r = 0; r < 5; r++) {
      const line = opp.patternLines[r];
      const cnt = line.filter((t) => t !== null).length;
      const cap = r + 1;
      if (cnt > 0 && cnt === cap - 1 && line.some((t) => t === move.color)) {
        score += 5;
      }
    }
  }

  // ═══════════════════════════════════════════
  // Giving opponents tiles
  // ═══════════════════════════════════════════
  if (remaining.length > 0) {
    for (let i = 0; i < state.players.length; i++) {
      if (i === pi) continue;
      const opp = state.players[i];
      for (const tile of remaining) {
        for (let r = 0; r < 5; r++) {
          const line = opp.patternLines[r];
          const cnt = line.filter((t) => t !== null).length;
          if (cnt > 0 && cnt === r && line.some((t) => t === tile)) {
            score -= 5;
          }
        }
      }
    }
  }

  return score;
}

function findBestCol(wall: WallCell[][], row: number, color: TileColor): number {
  let best = -1, bestS = -1;
  for (let c = 0; c < 5; c++) {
    if (wall[row][c].placed) continue;
    let conflict = false;
    for (let r = 0; r < 5; r++) {
      if (wall[r][c].placed && wall[r][c].color === color) { conflict = true; break; }
    }
    if (conflict) continue;
    wall[row][c].placed = true;
    wall[row][c].color = color;
    const s = scoreWall(wall, row, c) * COLUMN_WEIGHTS[c];
    wall[row][c].placed = false;
    if (s > bestS) { bestS = s; best = c; }
  }
  return best;
}

// ─────────────────────────────────────────────
// AI Levels
// ─────────────────────────────────────────────

function getEasyMove(state: GameState): AIMove {
  const moves = generateAllMoves(state, state.currentPlayerIndex);
  if (moves.length === 0) return fallback(state);
  const row = moves.filter((m) => m.targetRowIndex !== 'floor');
  const pool = row.length > 0 ? row : moves;
  return pool[Math.floor(Math.random() * pool.length)];
}

function getNormalMove(state: GameState): AIMove {
  const pi = state.currentPlayerIndex;
  const moves = generateAllMoves(state, pi);
  if (moves.length === 0) return fallback(state);
  const scored: ScoredMove[] = moves.map((m) => ({ ...m, score: quickEvalMove(state, m, pi) }));
  scored.sort((a, b) => b.score - a.score);
  return scored[0];
}

function getHardMove(state: GameState): AIMove {
  const pi = state.currentPlayerIndex;
  const moves = generateAllMoves(state, pi);
  if (moves.length === 0) return fallback(state);
  if (moves.length === 1) return moves[0];

  const total = countRemainingTiles(state);
  let depth: number;
  if (total <= 6) depth = 8;
  else if (total <= 12) depth = 6;
  else if (total <= 20) depth = 4;
  else depth = 3;

  const scored: ScoredMove[] = moves.map((m) => ({ ...m, score: quickEvalMove(state, m, pi) }));
  scored.sort((a, b) => b.score - a.score);

  const search = scored.slice(0, Math.min(20, scored.length));
  let best = search[0], bestS = -Infinity;

  for (const m of search) {
    const ns = simulateDraft(state, m, pi);
    let s: number;
    if (ns.phase === 'game_over') {
      s = terminal(ns, pi);
    } else if (ns.phase !== 'drafting') {
      s = evaluateRelative(ns, pi);
    } else {
      s = minimax(ns, depth - 1, -Infinity, Infinity, ns.currentPlayerIndex === pi, pi);
    }
    // Preserve the immediate strategic preference for finishing long lines;
    // a shallow search can otherwise undervalue the wall placement it creates.
    s += m.score * 0.2;
    if (s > bestS) { bestS = s; best = m; }
  }
  return best;
}

function terminal(s: GameState, pi: number): number {
  const my = s.players[pi].score;
  let best = 0;
  for (let i = 0; i < s.players.length; i++) {
    if (i !== pi && s.players[i].score > best) best = s.players[i].score;
  }
  if (my > best) return 1000 + (my - best);
  if (my < best) return -1000 + (my - best);
  return 0;
}

function minimax(s: GameState, d: number, a: number, b: number, max: boolean, root: number): number {
  if (s.phase === 'game_over') return terminal(s, root);
  if (d <= 0 || s.phase !== 'drafting') return evaluateRelative(s, root);

  const ci = s.currentPlayerIndex;
  const moves = generateAllMoves(s, ci);
  if (moves.length === 0) return evaluateRelative(s, root);

  const scored: ScoredMove[] = moves.map((m) => ({ ...m, score: quickEvalMove(s, m, ci) }));
  scored.sort((x, y) => max ? y.score - x.score : x.score - y.score);
  const search = scored.slice(0, d >= 4 ? 8 : 12);

  if (max) {
    let mx = -Infinity;
    for (const m of search) {
      const ns = simulateDraft(s, m, ci);
      const nm = ns.phase !== 'drafting' ? true : ns.currentPlayerIndex === root;
      const e = minimax(ns, d - 1, a, b, nm, root);
      mx = Math.max(mx, e);
      a = Math.max(a, e);
      if (b <= a) break;
    }
    return mx;
  } else {
    let mn = Infinity;
    for (const m of search) {
      const ns = simulateDraft(s, m, ci);
      const nm = ns.phase !== 'drafting' ? true : ns.currentPlayerIndex === root;
      const e = minimax(ns, d - 1, a, b, nm, root);
      mn = Math.min(mn, e);
      b = Math.min(b, e);
      if (b <= a) break;
    }
    return mn;
  }
}

// ─────────────────────────────────────────────
// Training
// ─────────────────────────────────────────────

const LR = 0.002;
const GAMMA = 0.97;

export function runOneTrainingGame(
  initGame: (...args: any[]) => GameState
): { scores: number[]; games: number } {
  const state: GameState = initGame(['RL_A', 'RL_B'], ['ai', 'ai'], ['hard', 'hard'], false, false);
  const traj: { f: number[]; pi: number }[] = [];
  let cur = state;
  let iter = 500;

  while (cur.phase === 'drafting' && iter-- > 0) {
    const pi = cur.currentPlayerIndex;
    const moves = generateAllMoves(cur, pi);
    if (moves.length === 0) break;

    traj.push({ f: extractFeatures(cur, pi), pi });

    const scored: ScoredMove[] = moves.map((m) => ({ ...m, score: quickEvalMove(cur, m, pi) }));
    scored.sort((a, b) => b.score - a.score);

    let chosen: AIMove;
    if (Math.random() < 0.15) {
      const row = scored.filter((m) => m.targetRowIndex !== 'floor');
      const pool = row.length > 0 ? row : scored;
      chosen = pool[Math.floor(Math.random() * pool.length)];
    } else {
      chosen = scored[0];
    }

    cur = simulateDraft(cur, chosen, pi);
    if (cur.phase !== 'drafting' && cur.phase !== 'game_over') break;
  }

  const finals = cur.players.map((p) => p.score);

  for (let t = traj.length - 1; t >= 0; t--) {
    const { f, pi } = traj[t];
    const pred = evaluateWithWeights(f, currentWeights);

    let target: number;
    if (t === traj.length - 1) {
      const my = finals[pi];
      let best = 0;
      for (let i = 0; i < finals.length; i++) {
        if (i !== pi && finals[i] > best) best = finals[i];
      }
      target = (my - best * 0.6) / 10;
    } else {
      let next = t + 1;
      while (next < traj.length && traj[next].pi !== pi) next++;
      if (next < traj.length) {
        target = GAMMA * evaluateWithWeights(traj[next].f, currentWeights);
      } else {
        const my = finals[pi];
        let best = 0;
        for (let i = 0; i < finals.length; i++) {
          if (i !== pi && finals[i] > best) best = finals[i];
        }
        target = (my - best * 0.6) / 10;
      }
    }

    const err = target - pred;
    for (let i = 0; i < NUM_FEATURES; i++) {
      currentWeights[i] += LR * err * f[i];
    }
  }

  trainingCount++;
  if (trainingCount % 10 === 0) saveWeights();
  return { scores: finals, games: trainingCount };
}

export function runTrainingBatch(n: number, init: (...args: any[]) => GameState): number {
  for (let i = 0; i < n; i++) runOneTrainingGame(init);
  saveWeights();
  return trainingCount;
}

// ─────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────

export function getAIMoveAdvanced(state: GameState): AIMove {
  const p = state.players[state.currentPlayerIndex];
  const d = p.aiDifficulty || 'normal';
  switch (d) {
    case 'easy': return getEasyMove(state);
    case 'normal': return getNormalMove(state);
    case 'hard': return getHardMove(state);
    default: return getNormalMove(state);
  }
}

function fallback(s: GameState): AIMove {
  for (let i = 0; i < s.plates.length; i++) {
    if (s.plates[i].tiles.length > 0) {
      return { source: { plateIndex: i }, color: s.plates[i].tiles[0], targetRowIndex: 'floor' };
    }
  }
  if (s.center.tiles.length > 0) {
    return { source: 'center', color: s.center.tiles[0], targetRowIndex: 'floor' };
  }
  return { source: 'center', color: 'blue', targetRowIndex: 'floor' };
}
