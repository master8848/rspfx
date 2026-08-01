import { describe, it, expect } from 'vitest';
import { EnvironmentType, PropertyPaneFieldType } from '../src/index.js';

describe('EnvironmentType', () => {
  it('has the SPFx-mirror values', () => {
    expect(EnvironmentType.Test).toBe(0);
    expect(EnvironmentType.Local).toBe(1);
    expect(EnvironmentType.SharePoint).toBe(2);
    expect(EnvironmentType.ClassicSharePoint).toBe(3);
  });

  it('is a bidirectional numeric enum', () => {
    expect(EnvironmentType[0]).toBe('Test');
    expect(EnvironmentType[1]).toBe('Local');
    expect(EnvironmentType[2]).toBe('SharePoint');
    expect(EnvironmentType[3]).toBe('ClassicSharePoint');
  });
});

describe('PropertyPaneFieldType', () => {
  it('has the SPFx-mirror values', () => {
    const expected: Record<keyof typeof PropertyPaneFieldType, number> = {
      Custom: 1,
      CheckBox: 2,
      TextField: 3,
      Toggle: 5,
      Dropdown: 6,
      Label: 7,
      Slider: 8,
      Heading: 9,
      ChoiceGroup: 10,
      Button: 11,
      HorizontalRule: 12,
      Link: 13,
      DynamicField: 14,
      DynamicTextField: 15,
      DynamicFieldSet: 16,
      SpinButton: 17,
      ThumbnailPicker: 18,
      IconPicker: 19,
      AlternativeText: 20,
      WebPartTitleHeading: 21,
      SortableAccordion: 22
    };
    for (const [key, value] of Object.entries(expected)) {
      expect(PropertyPaneFieldType[key as keyof typeof PropertyPaneFieldType]).toBe(value);
    }
  });

  it('exposes reverse mappings', () => {
    expect(PropertyPaneFieldType[1]).toBe('Custom');
    expect(PropertyPaneFieldType[19]).toBe('IconPicker');
    expect(PropertyPaneFieldType[22]).toBe('SortableAccordion');
  });
});
