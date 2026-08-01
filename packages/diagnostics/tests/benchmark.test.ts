import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { reportBenchmark, timeStart, trace } from '../src/index.js';

describe('reportBenchmark', () => {
  let tmpDir: string;
  let originalCwd: string;

  beforeAll(() => {
    originalCwd = process.cwd();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rspfx-diag-'));
    process.chdir(tmpDir);
  });

  afterAll(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('appends JSON lines to .rspfx/benchmarks.jsonl relative to the cwd', () => {
    reportBenchmark('compile', 12.5);
    reportBenchmark('compile', 9.25);
    const file = path.join(tmpDir, '.rspfx', 'benchmarks.jsonl');
    expect(fs.existsSync(file)).toBe(true);
    const lines = fs.readFileSync(file, 'utf8').trim().split('\n');
    expect(lines).toHaveLength(2);
    const first = JSON.parse(lines[0]!) as { name: string; ms: number; timestamp: string };
    expect(first.name).toBe('compile');
    expect(first.ms).toBe(12.5);
    expect(typeof first.timestamp).toBe('string');
    const second = JSON.parse(lines[1]!) as { name: string; ms: number };
    expect(second.name).toBe('compile');
    expect(second.ms).toBe(9.25);
  });

  it('timeStart returns an elapsed-milliseconds function', () => {
    const done = timeStart('wait');
    const elapsed = done();
    expect(elapsed).toBeGreaterThanOrEqual(0);
    expect(elapsed).toBeLessThan(10_000);
  });

  it('trace returns the wrapped value and records a benchmark', async () => {
    const result = await trace('trace-me', async () => 42);
    expect(result).toBe(42);
    const file = path.join(tmpDir, '.rspfx', 'benchmarks.jsonl');
    const lines = fs.readFileSync(file, 'utf8').trim().split('\n');
    const last = JSON.parse(lines[lines.length - 1]!) as { name: string; ms: number };
    expect(last.name).toBe('trace-me');
    expect(last.ms).toBeGreaterThanOrEqual(0);
  });

  it('trace rethrows errors but still records the benchmark', async () => {
    await expect(
      trace('failing', async () => {
        throw new Error('nope');
      })
    ).rejects.toThrow('nope');
    const file = path.join(tmpDir, '.rspfx', 'benchmarks.jsonl');
    const lines = fs.readFileSync(file, 'utf8').trim().split('\n');
    const last = JSON.parse(lines[lines.length - 1]!) as { name: string };
    expect(last.name).toBe('failing');
  });
});
