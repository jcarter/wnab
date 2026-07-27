export const MAPPING_STORAGE_VERSION = 1;
export const MAPPING_STORAGE_PREFIX = 'wnab.categoryMapping.v1';

function sortedPlanIds(planIds) {
  return [...planIds].sort();
}

export function getMappingStorageKey(planIds) {
  return `${MAPPING_STORAGE_PREFIX}.${sortedPlanIds(planIds).join('__')}`;
}

export function createEmptyMapping(planIds) {
  return {
    version: MAPPING_STORAGE_VERSION,
    planIds: sortedPlanIds(planIds),
    unifiedCategories: [],
  };
}

function hasStringArray(value) {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isValidCategory(category) {
  return Boolean(
    category &&
      typeof category === 'object' &&
      typeof category.id === 'string' &&
      typeof category.groupName === 'string' &&
      typeof category.name === 'string' &&
      hasStringArray(category.sourceIds),
  );
}

export function validateMappingShape(mapping, expectedPlanIds) {
  const expected = sortedPlanIds(expectedPlanIds);
  const actualPlanIds = Array.isArray(mapping?.planIds) ? sortedPlanIds(mapping.planIds) : [];

  return Boolean(
    mapping &&
      typeof mapping === 'object' &&
      mapping.version === MAPPING_STORAGE_VERSION &&
      JSON.stringify(actualPlanIds) === JSON.stringify(expected) &&
      Array.isArray(mapping.unifiedCategories) &&
      mapping.unifiedCategories.every(isValidCategory),
  );
}

export function normalizeMapping(mapping) {
  return {
    version: MAPPING_STORAGE_VERSION,
    planIds: sortedPlanIds(mapping.planIds),
    unifiedCategories: mapping.unifiedCategories.map((category) => ({
      id: category.id,
      groupName: category.groupName,
      name: category.name,
      sourceIds: [...category.sourceIds],
    })),
  };
}

export function parseStoredMapping(stored, planIds) {
  try {
    const parsed = typeof stored === 'string' ? JSON.parse(stored) : stored;
    if (!validateMappingShape(parsed, planIds)) {
      throw new Error('invalid shape');
    }

    return { mapping: normalizeMapping(parsed), error: null };
  } catch {
    return {
      mapping: createEmptyMapping(planIds),
      error: 'Saved mapping is invalid and was ignored.',
    };
  }
}

export function parseImportedMapping(jsonText, expectedPlanIds) {
  try {
    const parsed = JSON.parse(jsonText);
    if (!validateMappingShape(parsed, expectedPlanIds)) {
      throw new Error('invalid shape');
    }

    return normalizeMapping(parsed);
  } catch {
    throw new Error('Mapping import failed: invalid mapping file.');
  }
}

export function serializeMapping(mapping) {
  return `${JSON.stringify(normalizeMapping(mapping), null, 2)}\n`;
}
