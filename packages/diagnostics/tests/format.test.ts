import { describe, expect, it } from 'vitest';
import { formatBytes } from '../src/index.js';

describe('formatBytes', () => {
  it('formats plain bytes without a decimal', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1)).toBe('1 B');
    expect(formatBytes(1023)).toBe('1023 B');
  });

  it('formats binary units with one decimal', () => {
    expect(formatBytes(1024)).toBe('1.0 KiB');
    expect(formatBytes(1536)).toBe('1.5 KiB');
    expect(formatBytes(1048576)).toBe('1.0 MiB');
    expect(formatBytes(1073741824)).toBe('1.0 GiB');
  });

  it('handles non-finite input without crashing', () => {
    expect(formatBytes(Number.NaN)).toBe('NaN B');
    expect(formatBytes(Number.POSITIVE_INFINITY)).toBe('Infinity B');
  });
});
