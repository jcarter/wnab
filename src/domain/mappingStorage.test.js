import { describe, expect, test } from 'vitest';
import { GROCERIES_MAPPING } from '../test/fixtures/ynabResponses.js';
import {
  createEmptyMapping,
  getMappingStorageKey,
  loadMapping,
  MAPPING_STORAGE_PREFIX,
  MAPPING_STORAGE_VERSION,
  parseImportedMapping,
  saveMapping,
  serializeMapping,
} from './mappingStorage.js';

function createFakeStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    dump() {
      return Object.fromEntries(values);
    },
  };
}

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

  test('saves and loads valid mappings using fake storage only', () => {
    const storage = createFakeStorage();

    saveMapping(GROCERIES_MAPPING, storage);

    expect(Object.keys(storage.dump())).toEqual(['ynabTogether.categoryMapping.v1.plan-a__plan-b']);
    expect(storage.dump()['ynabTogether.categoryMapping.v1.plan-a__plan-b']).not.toContain('fake-token');
    expect(loadMapping(['plan-b', 'plan-a'], storage)).toEqual({
      mapping: GROCERIES_MAPPING,
      error: null,
    });
  });

  test('returns an empty mapping and error for invalid stored data without deleting it', () => {
    const key = getMappingStorageKey(['plan-a', 'plan-b']);
    const storage = createFakeStorage({ [key]: '{bad json' });

    expect(loadMapping(['plan-a', 'plan-b'], storage)).toEqual({
      mapping: createEmptyMapping(['plan-a', 'plan-b']),
      error: 'Saved mapping is invalid and was ignored.',
    });
    expect(storage.dump()[key]).toBe('{bad json');
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
