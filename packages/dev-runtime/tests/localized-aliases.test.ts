import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { readLocalizedAliases, readLocalizedResources } from '../src/project.js';

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

describe('readLocalizedResources', () => {
  let dir: string;

  function writeProject(config: { localizedResources: Record<string, string> }): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rspfx-loc-'));
    fs.mkdirSync(path.join(root, 'config'), { recursive: true });
    fs.mkdirSync(path.join(root, 'src', 'loc'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'config', 'config.json'),
      JSON.stringify(config)
    );
    return root;
  }

  it('discovers locale files under src/ for lib/ patterns', () => {
    const root = writeProject({
      localizedResources: { CommonStrings: 'lib/loc/{locale}.js' }
    });
    fs.writeFileSync(path.join(root, 'src', 'loc', 'en-us.js'), 'define([], function(){ return {}; });');
    fs.writeFileSync(path.join(root, 'src', 'loc', 'fr-fr.js'), 'define([], function(){ return {}; });');
    fs.writeFileSync(path.join(root, 'src', 'loc', 'en-us.d.ts'), 'declare const x: any;');

    const resources = readLocalizedResources(root, JSON.parse(
      fs.readFileSync(path.join(root, 'config', 'config.json'), 'utf8')
    ));
    expect(resources).toHaveLength(1);
    expect(resources[0]!.name).toBe('CommonStrings');
    expect(resources[0]!.files.map((file) => file.locale).sort()).toEqual(['en-us', 'fr-fr']);
    expect(resources[0]!.files[0]!.path).toBe(path.join(root, 'src', 'loc', 'en-us.js'));
  });

  it('skips resources whose loc directory does not exist', () => {
    const root = writeProject({
      localizedResources: { MissingStrings: 'lib/missing/{locale}.js' }
    });
    expect(readLocalizedResources(root, JSON.parse(
      fs.readFileSync(path.join(root, 'config', 'config.json'), 'utf8')
    ))).toEqual([]);
  });

  it('returns an empty list when no localizedResources are declared', () => {
    const root = writeProject({ localizedResources: {} });
    expect(readLocalizedResources(root, JSON.parse(
      fs.readFileSync(path.join(root, 'config', 'config.json'), 'utf8')
    ))).toEqual([]);
  });
});
