import { describe, it, expect } from 'vitest';
import { EnvironmentType, PropertyPaneFieldType } from '../src/index.js';

describe('EnvironmentType', () => {
  it('has the SPFx-mirror values', () => {
    expect(EnvironmentType.Local).toBe(0);
    expect(EnvironmentType.ClassicSharePoint).toBe(1);
    expect(EnvironmentType.SharePoint).toBe(2);
  });

  it('is a bidirectional numeric enum', () => {
    expect(EnvironmentType[0]).toBe('Local');
    expect(EnvironmentType[1]).toBe('ClassicSharePoint');
    expect(EnvironmentType[2]).toBe('SharePoint');
  });
});

describe('PropertyPaneFieldType', () => {
  it('has the SPFx-mirror values', () => {
    const expected: Record<keyof typeof PropertyPaneFieldType, number> = {
      Custom: 1,
      CheckBox: 2,
      TextField: 3,
      Dropdown: 4,
      Toggle: 5,
      Link: 6,
      Slider: 7,
      Heading: 8,
      ChoiceGroup: 9,
      Button: 10,
      HorizontalRule: 11,
      Image: 12,
      Thumbnail: 13,
      ColorPicker: 14,
      SpinButton: 15,
      Label: 16,
      DynamicField: 17,
      DynamicFieldSet: 18,
      DynamicData: 19
    };
    for (const [key, value] of Object.entries(expected)) {
      expect(PropertyPaneFieldType[key as keyof typeof PropertyPaneFieldType]).toBe(value);
    }
  });

  it('exposes reverse mappings', () => {
    expect(PropertyPaneFieldType[1]).toBe('Custom');
    expect(PropertyPaneFieldType[19]).toBe('DynamicData');
  });
});
