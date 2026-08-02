import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { readLocalizedAliases } from '../src/project.js';

describe('readLocalizedAliases', () => {
  const ROOT = path.join(path.sep, 'proj');

  it('maps project localizedResources from the Heft lib/ convention to src/', () => {
    const aliases = readLocalizedAliases(ROOT, {
      localizedResources: {
        SearchResultsWebPartStrings: 'lib/webparts/searchResults/loc/{locale}.js',
        CommonStrings: 'lib/loc/{locale}.js'
      }
    });
    expect(aliases['SearchResultsWebPartStrings']).toBe(
      path.join(ROOT, 'src', 'webparts', 'searchResults', 'loc', 'en-us')
    );
    expect(aliases['CommonStrings']).toBe(path.join(ROOT, 'src', 'loc', 'en-us'));
  });

  it('keeps node_modules localized resources pointing into the package', () => {
    const aliases = readLocalizedAliases(ROOT, {
      localizedResources: {
        ControlStrings: 'node_modules/@pnp/spfx-controls-react/lib/loc/{locale}.js'
      }
    });
    expect(aliases['ControlStrings']).toBe(
      path.join(ROOT, 'node_modules', '@pnp', 'spfx-controls-react', 'lib', 'loc', 'en-us')
    );
  });

  it('returns an empty map when no localizedResources are declared', () => {
    expect(readLocalizedAliases(ROOT, {})).toEqual({});
    expect(readLocalizedAliases(ROOT, undefined)).toEqual({});
  });

  it('skips entries without the {locale} placeholder', () => {
    const aliases = readLocalizedAliases(ROOT, {
      localizedResources: { StaticStrings: 'lib/static-strings.js' }
    });
    expect(aliases).toEqual({});
  });
});
