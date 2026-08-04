import type { FrameworkId } from '@mbsks/rspfx-core';
import type { ComponentType } from '@mbsks/rspfx-templates';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

export const FRAMEWORK_CHOICES: readonly FrameworkId[] = ['react', 'vanilla', 'solid', 'preact', 'vue', 'svelte'];
export const DEFAULT_FRAMEWORK: FrameworkId = 'react';

export const COMPONENT_CHOICES: readonly ComponentType[] = ['webpart', 'applicationcustomizer', 'fieldcustomizer', 'listviewcommandset'];
export const DEFAULT_COMPONENT: ComponentType = 'webpart';

export async function promptChoice(
  question: string,
  choices: readonly string[],
  defaultChoice: string
): Promise<string> {
  const rl = createInterface({ input, output });
  try {
    for (;;) {
      const answer = (await rl.question(`${question} (${choices.join('/')}) [${defaultChoice}]: `)).trim().toLowerCase();
      if (!answer) {
        return defaultChoice;
      }
      if (choices.includes(answer)) {
        return answer;
      }
      process.stdout.write(`Please choose one of: ${choices.join(', ')}\n`);
    }
  } finally {
    rl.close();
  }
}

export async function promptConfirm(question: string, defaultYes: boolean): Promise<boolean> {
  const rl = createInterface({ input, output });
  try {
    const answer = (await rl.question(`${question} [${defaultYes ? 'Y/n' : 'y/N'}]: `)).trim().toLowerCase();
    if (!answer) {
      return defaultYes;
    }
    return answer === 'y' || answer === 'yes';
  } finally {
    rl.close();
  }
}

export async function promptText(question: string, defaultValue?: string): Promise<string> {
  const rl = createInterface({ input, output });
  try {
    const answer = await rl.question(defaultValue ? `${question} [${defaultValue}]: ` : `${question}: `);
    const trimmed = answer.trim();
    return trimmed || (defaultValue ?? '');
  } finally {
    rl.close();
  }
}
