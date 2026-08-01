import { describe, it, expect } from 'vitest';
import { Version } from '../src/index.js';

describe('Version', () => {
  describe('parse', () => {
    it('parses a 3-part version', () => {
      const v = Version.parse('1.0.0');
      expect(v.major).toBe(1);
      expect(v.minor).toBe(0);
      expect(v.patch).toBe(0);
      expect(v.build).toBe(0);
      expect(v.toString()).toBe('1.0.0');
    });

    it('parses a 4-part version', () => {
      const v = Version.parse('1.0.0.0');
      expect(v.major).toBe(1);
      expect(v.minor).toBe(0);
      expect(v.patch).toBe(0);
      expect(v.build).toBe(0);
      expect(v.toString()).toBe('1.0.0.0');
    });

    it('parses a 2-part version and preserves part count in toString', () => {
      const v = Version.parse('1.0');
      expect(v.major).toBe(1);
      expect(v.minor).toBe(0);
      expect(v.patch).toBe(0);
      expect(v.build).toBe(0);
      expect(v.toString()).toBe('1.0');
    });

    it('discards leading zeroes but keeps numeric value', () => {
      const v = Version.parse('01.02.03');
      expect(v.major).toBe(1);
      expect(v.minor).toBe(2);
      expect(v.patch).toBe(3);
      expect(v.toString()).toBe('1.2.3');
    });

    it('throws on an invalid version string', () => {
      expect(() => Version.parse('abc')).toThrow();
      expect(() => Version.parse('1')).toThrow();
      expect(() => Version.parse('1.2.3.4.5')).toThrow();
      expect(() => Version.parse('')).toThrow();
      expect(() => Version.parse('1.0.0-beta')).toThrow();
      expect(() => Version.parse('1..3')).toThrow();
    });
  });

  describe('tryParse', () => {
    it('returns a Version for a valid string', () => {
      expect(Version.tryParse('1.2.3')?.toString()).toBe('1.2.3');
      expect(Version.tryParse('1.2.3.4')?.toString()).toBe('1.2.3.4');
    });

    it('returns undefined for invalid strings', () => {
      expect(Version.tryParse('')).toBeUndefined();
      expect(Version.tryParse('1')).toBeUndefined();
      expect(Version.tryParse('1.2.3.4.5')).toBeUndefined();
      expect(Version.tryParse('abc')).toBeUndefined();
      expect(Version.tryParse('1.2.3-beta')).toBeUndefined();
      expect(Version.tryParse(' 1.2.3')).toBeUndefined();
      expect(Version.tryParse('1.2.')).toBeUndefined();
    });
  });

  describe('compare', () => {
    it('returns 0 for equal versions', () => {
      expect(Version.compare('1.0.0', '1.0.0')).toBe(0);
      expect(Version.compare('1.0', '1.0.0')).toBe(0);
      expect(Version.compare('2.0', '2.0.0.0')).toBe(0);
    });

    it('returns -1 when the first version is older', () => {
      expect(Version.compare('1.0.0', '1.0.1')).toBe(-1);
      expect(Version.compare('1.9.9', '2.0.0')).toBe(-1);
      expect(Version.compare('1.0.0.0', '1.0.0.1')).toBe(-1);
    });

    it('returns 1 when the first version is newer', () => {
      expect(Version.compare('1.0.1', '1.0.0')).toBe(1);
      expect(Version.compare('2.0.0', '1.9.9')).toBe(1);
      expect(Version.compare('1.0.0.1', '1.0.0.0')).toBe(1);
    });

    it('throws when either input cannot be parsed', () => {
      expect(() => Version.compare('1.0.0', 'bogus')).toThrow();
      expect(() => Version.compare('bogus', '1.0.0')).toThrow();
    });
  });

  describe('compareTo', () => {
    it('returns 0 for equal versions', () => {
      expect(Version.parse('1.0.0').compareTo(Version.parse('1.0.0'))).toBe(0);
    });

    it('returns -1 when this version is older', () => {
      expect(Version.parse('1.0.0').compareTo(Version.parse('1.0.1'))).toBe(-1);
      expect(Version.parse('1.0').compareTo(Version.parse('1.0.0.1'))).toBe(-1);
    });

    it('returns 1 when this version is newer', () => {
      expect(Version.parse('1.1.0').compareTo(Version.parse('1.0.9'))).toBe(1);
    });
  });

  describe('toString', () => {
    it('stringifies the constructor arguments', () => {
      expect(new Version(1, 2, 3).toString()).toBe('1.2.3');
      expect(new Version(1, 2, 3, 4).toString()).toBe('1.2.3.4');
    });

    it('preserves an explicit zero build part', () => {
      expect(new Version(1, 2, 3, 0).toString()).toBe('1.2.3.0');
    });
  });
});
