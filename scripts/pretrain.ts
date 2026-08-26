import { writeFileSync } from 'node:fs';
import { runTrainingBatch, exportWeights } from '../src/utils/aiEngine';
import { initializeGame } from '../src/utils/gameEngine';

const count = Number.parseInt(process.argv[2] ?? '1000000', 10);
if (!Number.isInteger(count) || count <= 0) {
  throw new Error('Training game count must be a positive integer.');
}
const startedAt = Date.now();
runTrainingBatch(count, initializeGame);
writeFileSync(process.argv[3] ?? 'pretrained-weights.json', exportWeights());
console.log(`trained ${count} games in ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
