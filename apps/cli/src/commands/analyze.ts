import fs from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { createLogger, formatBytes, RspfxError } from '@mbsks/rspfx-diagnostics';
import { loadConfig } from '../config.js';
import { runBuild } from './build.js';

const logger = createLogger('rspfx');

export interface AnalyzeOptions {
  build?: boolean;
}

interface BundleRow {
  name: string;
  size: number;
  gzipSize: number;
  modules: number;
}

export async function runAnalyze(cwd: string, opts: AnalyzeOptions = {}): Promise<{ reportPath: string; rows: BundleRow[] }> {
  const config = await loadConfig(cwd);
  const distDir = path.join(cwd, config.build.outDir ?? 'dist');

  let stats: { toJson(options: { all: boolean; chunks: boolean; chunkModules: boolean }): unknown } | undefined;
  if (opts.build !== false) {
    const result = await runBuild(cwd, {});
    stats = result.stats as typeof stats;
  } else {
    if (!fs.existsSync(distDir)) {
      throw new RspfxError('ANALYZE_NO_DIST', `No build output found in ${distDir}. Run "rspfx build" or drop --no-build.`);
    }
  }

  const moduleCounts = collectModuleCounts(stats);
  const rows: BundleRow[] = [];
  for (const file of fs.readdirSync(distDir)) {
    if (file.endsWith('.map') || file.endsWith('.manifest.json') || !fs.statSync(path.join(distDir, file)).isFile()) {
      continue;
    }
    const content = fs.readFileSync(path.join(distDir, file));
    rows.push({
      name: file,
      size: content.length,
      gzipSize: gzipSync(content).length,
      modules: moduleCounts.get(file.replace(/\.js$/, '')) ?? 0
    });
  }
  rows.sort((a, b) => b.size - a.size);

  const reportPath = path.join(cwd, '.rspfx', 'analyze.html');
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, renderReport(rows));

  console.table(rows.map((row) => ({ ...row, size: formatBytes(row.size), gzip: formatBytes(row.gzipSize) })));
  logger.success(`Analysis written to ${reportPath}`);
  return { reportPath, rows };
}

function collectModuleCounts(stats: unknown): Map<string, number> {
  const counts = new Map<string, number>();
  if (!stats || typeof (stats as { toJson?: unknown }).toJson !== 'function') {
    return counts;
  }
  const json = (stats as { toJson(options: unknown): { chunks?: unknown } }).toJson({
    all: false,
    chunks: true,
    chunkModules: true
  });
  const chunks = Array.isArray(json.chunks) ? json.chunks : [];
  for (const chunk of chunks) {
    const record = chunk as {
      name?: string;
      names?: string[];
      modules?: unknown[];
      entry?: boolean;
      initial?: boolean;
    };
    if (!record.entry && !record.initial) {
      continue;
    }
    const name = record.name ?? record.names?.[0];
    if (!name) {
      continue;
    }
    counts.set(name, Array.isArray(record.modules) ? record.modules.length : 0);
  }
  return counts;
}

function renderReport(rows: BundleRow[]): string {
  const body = rows
    .map(
      (row) =>
        `<tr><td>${escapeHtml(row.name)}</td><td>${formatBytes(row.size)}</td><td>${formatBytes(row.gzipSize)}</td><td>${row.modules}</td></tr>`
    )
    .join('\n');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>rspfx bundle analysis</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 2rem; }
  h1 { font-size: 1.4rem; }
  table { border-collapse: collapse; width: 100%; max-width: 720px; }
  th, td { text-align: left; padding: 0.4rem 0.8rem; border-bottom: 1px solid #ddd; }
  th { background: #f5f5f5; }
</style>
</head>
<body>
<h1>rspfx bundle analysis</h1>
<table>
<thead>
<tr><th>Bundle</th><th>Size</th><th>Gzip</th><th>Modules</th></tr>
</thead>
<tbody>
${body}
</tbody>
</table>
</body>
</html>
`;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
