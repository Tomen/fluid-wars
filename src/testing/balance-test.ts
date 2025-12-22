// Balance Test Runner
// Runs scenarios to measure corner camping vs open field outcomes

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { GameSimulator } from '../core/GameSimulator';
import type { ScenarioConfig } from '../game/scenario';
import type { AIAction } from '../core/AIInterface';

interface TestResult {
  scenario: string;
  run: number;
  winner: number;
  steps: number;
  finalParticleCounts: number[];
  timedOut: boolean;
}

interface ScenarioResults {
  scenario: string;
  runs: TestResult[];
  summary: {
    player0Wins: number;
    player1Wins: number;
    timeouts: number;
    avgSteps: number;
    avgStepsToWin: number;
  };
}

/**
 * Load scenario from YAML file
 */
function loadScenarioFile(filepath: string): ScenarioConfig {
  const content = fs.readFileSync(filepath, 'utf-8');
  return yaml.load(content) as ScenarioConfig;
}

/**
 * Run a single scenario test
 */
function runScenario(scenario: ScenarioConfig, run: number): TestResult {
  const testConfig = scenario.test;
  if (!testConfig) {
    throw new Error(`Scenario "${scenario.name}" has no test configuration`);
  }

  // Create simulator with scenario
  const simulator = new GameSimulator(
    {
      playerCount: scenario.game.playerCount,
      particlesPerPlayer: scenario.game.particlesPerPlayer ?? 100,
      canvasWidth: scenario.game.canvasWidth,
      canvasHeight: scenario.game.canvasHeight,
      maxSteps: testConfig.maxSteps,
      winConfig: scenario.win,
    },
    {},
    scenario
  );

  // Normalize cursor targets to [0,1] range
  const normalizedTargets = testConfig.cursorTargets.map(t => ({
    x: t.x / scenario.game.canvasWidth,
    y: t.y / scenario.game.canvasHeight,
  }));

  // Create fixed actions map
  const actions = new Map<number, AIAction>();
  for (let i = 0; i < scenario.game.playerCount; i++) {
    actions.set(i, {
      targetX: normalizedTargets[i]?.x ?? 0.5,
      targetY: normalizedTargets[i]?.y ?? 0.5,
    });
  }

  // Run simulation
  let stepCount = 0;
  while (!simulator.isTerminal()) {
    simulator.step(actions);
    stepCount++;
  }

  const winner = simulator.getWinner();
  const game = simulator.getGame();
  const players = game.getPlayers();
  const finalParticleCounts = players.map(p => p.particleCount);
  const timedOut = winner === -1;

  simulator.destroy();

  return {
    scenario: scenario.name,
    run,
    winner,
    steps: stepCount,
    finalParticleCounts,
    timedOut,
  };
}

/**
 * Run all tests for a scenario
 */
function runScenarioTests(scenarioPath: string): ScenarioResults {
  const scenario = loadScenarioFile(scenarioPath);
  const runs = scenario.test?.runs ?? 5;

  console.log(`\nRunning scenario: ${scenario.name}`);
  console.log(`  ${runs} runs, max ${scenario.test?.maxSteps} steps each`);

  const results: TestResult[] = [];
  for (let i = 0; i < runs; i++) {
    const result = runScenario(scenario, i + 1);
    results.push(result);
    process.stdout.write(`  Run ${i + 1}: ${result.timedOut ? 'TIMEOUT' : `P${result.winner} wins`} in ${result.steps} steps\n`);
  }

  // Calculate summary statistics
  const player0Wins = results.filter(r => r.winner === 0).length;
  const player1Wins = results.filter(r => r.winner === 1).length;
  const timeouts = results.filter(r => r.timedOut).length;
  const avgSteps = results.reduce((sum, r) => sum + r.steps, 0) / results.length;
  const winsOnly = results.filter(r => !r.timedOut);
  const avgStepsToWin = winsOnly.length > 0
    ? winsOnly.reduce((sum, r) => sum + r.steps, 0) / winsOnly.length
    : Infinity;

  return {
    scenario: scenario.name,
    runs: results,
    summary: {
      player0Wins,
      player1Wins,
      timeouts,
      avgSteps,
      avgStepsToWin,
    },
  };
}

/**
 * Print comparison summary
 */
function printComparison(results: ScenarioResults[]): void {
  console.log('\n' + '='.repeat(70));
  console.log('BALANCE TEST RESULTS');
  console.log('='.repeat(70));

  console.log('\nScenario Results:');
  console.log('-'.repeat(70));

  for (const r of results) {
    const s = r.summary;
    console.log(`\n${r.scenario}:`);
    console.log(`  P0 wins: ${s.player0Wins}/${r.runs.length}  P1 wins: ${s.player1Wins}/${r.runs.length}  Timeouts: ${s.timeouts}`);
    console.log(`  Avg steps: ${s.avgSteps.toFixed(0)}  Avg steps to win: ${s.avgStepsToWin === Infinity ? 'N/A' : s.avgStepsToWin.toFixed(0)}`);
  }

  // Compare corner vs open
  const corner2to1 = results.find(r => r.scenario.includes('Corner 2:1'));
  const open2to1 = results.find(r => r.scenario.includes('Open 2:1'));

  if (corner2to1 && open2to1) {
    console.log('\n' + '-'.repeat(70));
    console.log('CORNER VS OPEN COMPARISON (2:1 ratio):');

    const cornerWinRate = corner2to1.summary.player1Wins / corner2to1.runs.length;
    const openWinRate = open2to1.summary.player1Wins / open2to1.runs.length;

    console.log(`  Corner - Attacker (P1) win rate: ${(cornerWinRate * 100).toFixed(0)}%`);
    console.log(`  Open   - Attacker (P1) win rate: ${(openWinRate * 100).toFixed(0)}%`);

    if (corner2to1.summary.avgStepsToWin !== Infinity && open2to1.summary.avgStepsToWin !== Infinity) {
      const ratio = corner2to1.summary.avgStepsToWin / open2to1.summary.avgStepsToWin;
      console.log(`  Time ratio (corner/open): ${ratio.toFixed(2)}x`);
      if (ratio > 1.5) {
        console.log(`  >> CORNER CAMPING DETECTED: Takes ${ratio.toFixed(1)}x longer to win in corner`);
      } else if (ratio < 0.67) {
        console.log(`  >> Corners are WEAKER than open field`);
      } else {
        console.log(`  >> Balance looks reasonable`);
      }
    }
  }

  console.log('\n' + '='.repeat(70));
}

/**
 * Main entry point
 */
async function main() {
  const scenariosDir = path.resolve(process.cwd(), 'scenarios', 'balance');

  // Check if scenarios directory exists
  if (!fs.existsSync(scenariosDir)) {
    console.error(`Error: Scenarios directory not found: ${scenariosDir}`);
    process.exit(1);
  }

  // Find all scenario files
  const files = fs.readdirSync(scenariosDir).filter(f => f.endsWith('.yaml'));

  if (files.length === 0) {
    console.error('No scenario files found');
    process.exit(1);
  }

  console.log(`Found ${files.length} balance test scenarios`);

  // Run all scenarios
  const results: ScenarioResults[] = [];
  for (const file of files) {
    const filepath = path.join(scenariosDir, file);
    try {
      const result = runScenarioTests(filepath);
      results.push(result);
    } catch (error) {
      console.error(`Error running ${file}:`, error);
    }
  }

  // Print comparison
  printComparison(results);
}

main().catch(console.error);
