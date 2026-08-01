import { rspack, type Compiler, type Configuration, type Stats } from '@rspack/core';
import type { CompileContext, WatchHandle } from './types.js';
import { createRspackConfig } from './config.js';

export function watch(
  ctx: CompileContext,
  onDone: (stats: unknown, errors: unknown[]) => void
): WatchHandle {
  let compiler: Compiler | undefined;
  let closed = false;

  void createRspackConfig({ ...ctx, serveMode: true })
    .then((config) => {
      if (closed) {
        return;
      }
      compiler = rspack(config as Configuration);
      compiler.watch({}, (err, stats) => {
        if (closed) {
          return;
        }
        if (err) {
          onDone(null, [err.message]);
          return;
        }
        if (!stats) {
          onDone(null, ['rspack watch finished without stats']);
          return;
        }
        const errors = stats.hasErrors()
          ? (stats.toJson({ all: false, errors: true }).errors ?? []).map((error) => error.message)
          : [];
        onDone(stats, errors);
      });
    })
    .catch((err: unknown) => {
      onDone(null, [err instanceof Error ? err.message : String(err)]);
    });

  return {
    close: async () => {
      closed = true;
      if (compiler) {
        const current = compiler;
        compiler = undefined;
        await new Promise<void>((resolve) => {
          current.close(() => resolve());
        });
      }
    }
  };
}
