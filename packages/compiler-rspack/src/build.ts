import { rspack, type Compiler, type Configuration, type Stats } from '@rspack/core';
import type { BuildResult, CompileContext } from './types.js';
import { RspfxError } from './errors.js';
import { createRspackConfig } from './config.js';
import { createLogger } from '@mbsks/rspfx-diagnostics';

const logger = createLogger('compiler-rspack');

function runCompiler(compiler: Compiler): Promise<Stats> {
  return new Promise((resolve, reject) => {
    compiler.run((err, stats) => {
      if (err) {
        reject(new RspfxError('COMPILE_FAILED', 'rspack compilation error', err));
        return;
      }
      if (!stats) {
        reject(new RspfxError('COMPILE_FAILED', 'rspack finished without stats'));
        return;
      }
      resolve(stats);
    });
  });
}

export async function build(ctx: CompileContext): Promise<BuildResult> {
  const config = (await createRspackConfig(ctx)) as Configuration;
  const compiler = rspack(config);
  const stats = await runCompiler(compiler);

  if (stats.hasWarnings()) {
    const warnings = stats.toJson({ all: false, warnings: true }).warnings ?? [];
    for (const warning of warnings) {
      logger.warn(`warning: ${warning.message}`);
    }
  }
  if (stats.hasErrors()) {
    const errors = stats.toJson({ all: false, errors: true }).errors ?? [];
    const messages = errors.map((error) => error.message).join('\n');
    throw new RspfxError('BUILD_FAILED', `rspack build failed:\n${messages}`);
  }

  const outputFiles = Object.keys(stats.compilation.assets);
  return { stats, outputFiles };
}
