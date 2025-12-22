// BalanceTestAnalyzer - Analyzes balance test results and generates reports
// Reusable between CLI (balance-test.ts) and browser UI

export interface ScenarioResult {
  scenarioName: string;
  winner: number;
  steps: number;
  duration: number;
  finalCounts: number[];
}

export interface BalanceReport {
  timestamp: string;
  summary: {
    totalTests: number;
    player0Wins: number;
    player1Wins: number;
    timeouts: number;
    avgSteps: number;
  };
  results: Array<{
    scenario: string;
    winner: string;
    steps: number;
    duration: string;
    finalCounts: number[];
  }>;
  analysis: string[];
}

export class BalanceTestAnalyzer {
  /**
   * Generate a full balance report from test results
   */
  generateReport(results: ScenarioResult[]): BalanceReport {
    return {
      timestamp: new Date().toISOString(),
      summary: this.generateSummary(results),
      results: results.map(r => ({
        scenario: r.scenarioName,
        winner: r.winner === -1 ? 'timeout' : `Player ${r.winner + 1}`,
        steps: r.steps,
        duration: `${r.duration.toFixed(1)}s`,
        finalCounts: r.finalCounts,
      })),
      analysis: this.analyzeResults(results),
    };
  }

  /**
   * Generate summary statistics
   */
  private generateSummary(results: ScenarioResult[]): BalanceReport['summary'] {
    return {
      totalTests: results.length,
      player0Wins: results.filter(r => r.winner === 0).length,
      player1Wins: results.filter(r => r.winner === 1).length,
      timeouts: results.filter(r => r.winner === -1).length,
      avgSteps: results.length > 0
        ? Math.round(results.reduce((sum, r) => sum + r.steps, 0) / results.length)
        : 0,
    };
  }

  /**
   * Analyze results to identify balance issues
   */
  analyzeResults(results: ScenarioResult[]): string[] {
    const analysis: string[] = [];

    // Find scenarios by type
    const corner2to1 = results.find(r =>
      r.scenarioName.includes('Corner') && r.scenarioName.includes('2:1')
    );
    const open2to1 = results.find(r =>
      r.scenarioName.includes('Open') && r.scenarioName.includes('2:1')
    );
    const cornerEven = results.find(r =>
      r.scenarioName.includes('Corner') && r.scenarioName.includes('Even')
    );
    const openEven = results.find(r =>
      r.scenarioName.includes('Open') && r.scenarioName.includes('Even')
    );

    // Analyze 2:1 matchups (attacker advantage scenarios)
    if (corner2to1 && open2to1) {
      // Corner camping: defender (P0, 50 particles) survives in corner but loses in open
      if (corner2to1.winner === 0 && open2to1.winner === 1) {
        analysis.push('CORNER CAMPING DETECTED: Defender survives in corner but loses in open field');
      }

      // Check if corners extend game time significantly
      if (corner2to1.steps > open2to1.steps * 1.5) {
        const extension = Math.round((corner2to1.steps / open2to1.steps - 1) * 100);
        analysis.push(`Corner extends game by ${extension}% - defensive advantage too strong`);
      }

      // Check if attacker always wins (expected with 2:1 advantage)
      if (corner2to1.winner === 1 && open2to1.winner === 1) {
        analysis.push('2:1 advantage correctly favors attacker in both scenarios');
      }

      // Check if defender wins both (very broken balance)
      if (corner2to1.winner === 0 && open2to1.winner === 0) {
        analysis.push('WARNING: Defender wins even with 2:1 disadvantage - conversion too weak');
      }
    }

    // Analyze even matchups (position advantage)
    if (cornerEven && openEven) {
      if (cornerEven.winner !== openEven.winner && cornerEven.winner !== -1 && openEven.winner !== -1) {
        analysis.push(
          `Position matters: Corner favors P${cornerEven.winner + 1}, Open favors P${openEven.winner + 1}`
        );
      }

      // Check if corner gives significant time advantage
      if (cornerEven.winner === -1 && openEven.winner !== -1) {
        analysis.push('Corner leads to timeout - stalemates more likely in corners');
      }
    }

    // Check for timeouts
    const timeouts = results.filter(r => r.winner === -1);
    if (timeouts.length > 0) {
      const timeoutNames = timeouts.map(t => t.scenarioName).join(', ');
      analysis.push(`${timeouts.length} timeout(s): ${timeoutNames} - games taking too long to resolve`);
    }

    // Check overall balance
    const p0Wins = results.filter(r => r.winner === 0).length;
    const p1Wins = results.filter(r => r.winner === 1).length;
    if (p0Wins > 0 && p1Wins > 0) {
      const ratio = p0Wins / p1Wins;
      if (ratio > 2) {
        analysis.push(`P1 (inner) wins ${p0Wins}/${results.length} - defensive position too strong`);
      } else if (ratio < 0.5) {
        analysis.push(`P2 (outer) wins ${p1Wins}/${results.length} - attacking position too strong`);
      }
    }

    if (analysis.length === 0) {
      analysis.push('No obvious balance issues detected');
    }

    return analysis;
  }

  /**
   * Export report as JSON string
   */
  toJSON(results: ScenarioResult[]): string {
    const report = this.generateReport(results);
    return JSON.stringify(report, null, 2);
  }

  /**
   * Log report to console
   */
  logReport(results: ScenarioResult[]): void {
    console.log('\n=== BALANCE TEST RESULTS ===');
    console.log(this.toJSON(results));
  }

  /**
   * Trigger file download in browser
   */
  downloadReport(results: ScenarioResult[]): void {
    const json = this.toJSON(results);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `balance-test-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
