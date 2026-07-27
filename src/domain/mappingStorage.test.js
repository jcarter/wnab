import { describe, expect, test } from 'vitest';
import { GROCERIES_MAPPING } from '../test/fixtures/ynabResponses.js';
import {
  createEmptyMapping,
  getMappingStorageKey,
  MAPPING_STORAGE_PREFIX,
  MAPPING_STORAGE_VERSION,
  parseImportedMapping,
  parseStoredMapping,
  serializeMapping,
} from './mappingStorage.js';

describe('mapping storage', () => {
  test('builds stable sorted storage keys and empty mappings', () => {
    expect(MAPPING_STORAGE_VERSION).toBe(1);
    expect(MAPPING_STORAGE_PREFIX).toBe('ynabTogether.categoryMapping.v1');
    expect(getMappingStorageKey(['plan-b', 'plan-a'])).toBe('ynabTogether.categoryMapping.v1.plan-a__plan-b');
    expect(createEmptyMapping(['plan-b', 'plan-a'])).toEqual({
      version: 1,
      planIds: ['plan-a', 'plan-b'],
      unifiedCategories: [],
    });
  });

  test('parses a valid mapping loaded from the server data file', () => {
    expect(parseStoredMapping(GROCERIES_MAPPING, ['plan-b', 'plan-a'])).toEqual({
      mapping: GROCERIES_MAPPING,
      error: null,
    });
  });

  test('returns an empty mapping and error for invalid stored data', () => {
    expect(parseStoredMapping('{bad json', ['plan-a', 'plan-b'])).toEqual({
      mapping: createEmptyMapping(['plan-a', 'plan-b']),
      error: 'Saved mapping is invalid and was ignored.',
    });
  });

  test('rejects imported mappings for different plan pairs', () => {
    expect(() => parseImportedMapping(JSON.stringify(GROCERIES_MAPPING), ['plan-a', 'plan-c'])).toThrow(
      'Mapping import failed: invalid mapping file.',
    );
  });

  test('rejects imported mappings with invalid category shape', () => {
    const badMapping = {
      ...GROCERIES_MAPPING,
      unifiedCategories: [{ id: 'bad', groupName: 'Group', name: 'Name', sourceIds: [123] }],
    };

    expect(() => parseImportedMapping(JSON.stringify(badMapping), ['plan-a', 'plan-b'])).toThrow(
      'Mapping import failed: invalid mapping file.',
    );
  });

  test('parses valid imported mappings and normalizes plan id order', () => {
    const imported = parseImportedMapping(JSON.stringify({ ...GROCERIES_MAPPING, planIds: ['plan-b', 'plan-a'] }), [
      'plan-b',
      'plan-a',
    ]);

    expect(imported.planIds).toEqual(['plan-a', 'plan-b']);
    expect(imported.unifiedCategories).toEqual(GROCERIES_MAPPING.unifiedCategories);
  });

  test('serializes stable pretty JSON', () => {
    expect(serializeMapping(GROCERIES_MAPPING)).toBe(`${JSON.stringify(GROCERIES_MAPPING, null, 2)}\n`);
  });
});
