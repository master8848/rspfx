import { readdir } from 'node:fs/promises';
import path from 'node:path';

export function globToRegExp(pattern: string): RegExp {
  let source = '^';
  for (let index = 0; index < pattern.length; index++) {
    const char = pattern[index] ?? '';
    if (char === '*') {
      if ((pattern[index + 1] ?? '') === '*') {
        index++;
        if (pattern[index + 1] === '/') {
          index++;
          source += '(?:.*/)?';
        } else {
          source += '.*';
        }
      } else {
        source += '[^/]*';
      }
    } else if (char === '?') {
      source += '[^/]';
    } else if (/[.+^${}()|[\]\\]/.test(char)) {
      source += `\\${char}`;
    } else {
      source += char;
    }
  }
  source += '$';
  return new RegExp(source);
}

export async function globFiles(dir: string, patterns: string[]): Promise<string[]> {
  const regexes = patterns.map(globToRegExp);
  const matches: string[] = [];
  await walk(path.resolve(dir), '', regexes, matches);
  return matches;
}

async function walk(dir: string, relativePath: string, regexes: RegExp[], matches: string[]): Promise<void> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    if (entry.isSymbolicLink()) {
      continue;
    }
    const childRelativePath = relativePath === '' ? entry.name : `${relativePath}/${entry.name}`;
    if (entry.isDirectory()) {
      await walk(path.join(dir, entry.name), childRelativePath, regexes, matches);
    } else if (entry.isFile() && regexes.some((regex) => regex.test(childRelativePath))) {
      matches.push(childRelativePath);
    }
  }
}
