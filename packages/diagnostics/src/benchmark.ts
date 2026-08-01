import * as fs from 'node:fs';
import * as path from 'node:path';

export function reportBenchmark(name: string, ms: number): void {
  const dir = path.join(process.cwd(), '.rspfx');
  fs.mkdirSync(dir, { recursive: true });
  const line = JSON.stringify({ name, ms, timestamp: new Date().toISOString() });
  fs.appendFileSync(path.join(dir, 'benchmarks.jsonl'), `${line}\n`);
}
