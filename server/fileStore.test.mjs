// @vitest-environment node

import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { GROCERIES_MAPPING } from '../src/test/fixtures/ynabResponses.js';
import { FileStore } from './fileStore.mjs';

const temporaryDirectories = [];

async function createStore() {
  const directory = await mkdtemp(join(tmpdir(), 'ynab-together-'));
  temporaryDirectories.push(directory);
  await mkdir(join(directory, 'nested'));
  return {
    filePath: join(directory, 'nested', 'together-budget.json'),
    store: new FileStore(join(directory, 'nested', 'together-budget.json')),
  };
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) =>
    rm(directory, { recursive: true, force: true })));
});

describe('FileStore', () => {
  test('creates the data file with only mappings and the selected budgets', async () => {
    const { filePath, store } = await createStore();
    const selectedBudgets = {
      leftPlanId: 'plan-a',
      rightPlanId: 'plan-b',
    };

    expect(await store.getMapping(['plan-a', 'plan-b'])).toBeNull();
    await Promise.all([
      store.saveMapping(GROCERIES_MAPPING),
      store.saveSelectedBudgets(selectedBudgets),
    ]);

    expect(await store.getMapping(['plan-b', 'plan-a'])).toEqual(GROCERIES_MAPPING);
    expect(await store.getSelectedBudgets()).toEqual(selectedBudgets);
    const persisted = JSON.parse(await readFile(filePath, 'utf8'));
    expect(persisted.version).toBe(3);
    expect(persisted.selectedBudgets).toEqual(selectedBudgets);
    expect(persisted.mappings['ynabTogether.categoryMapping.v1.plan-a__plan-b'])
      .toEqual(GROCERIES_MAPPING);
    expect(JSON.stringify(persisted)).not.toContain('accessToken');
    expect(JSON.stringify(persisted)).not.toContain('theme');
    expect(JSON.stringify(persisted)).not.toContain('selectedMonth');
  });

  test('migrates version 1 data without retaining the shared theme', async () => {
    const { filePath, store } = await createStore();
    await writeFile(filePath, JSON.stringify({
      version: 1,
      preferences: { theme: 'dark' },
      mappings: { existing: GROCERIES_MAPPING },
    }), 'utf8');

    expect(await store.getSelectedBudgets()).toBeNull();
    const migrated = JSON.parse(await readFile(filePath, 'utf8'));
    expect(migrated).toEqual({
      version: 3,
      selectedBudgets: null,
      mappings: { existing: GROCERIES_MAPPING },
    });
  });

  test('migrates version 2 data while moving its month out of the shared file', async () => {
    const { filePath, store } = await createStore();
    await writeFile(filePath, JSON.stringify({
      version: 2,
      selection: {
        leftPlanId: 'plan-a',
        rightPlanId: 'plan-b',
        selectedMonth: '2026-06-01',
      },
      mappings: {},
    }), 'utf8');

    expect(await store.getSelectedBudgets()).toEqual({
      leftPlanId: 'plan-a',
      rightPlanId: 'plan-b',
    });
    expect(JSON.parse(await readFile(filePath, 'utf8'))).toEqual({
      version: 3,
      selectedBudgets: {
        leftPlanId: 'plan-a',
        rightPlanId: 'plan-b',
      },
      mappings: {},
    });
  });

  test('rejects invalid existing data instead of overwriting it', async () => {
    const { filePath, store } = await createStore();
    await store.write({
      version: 3,
      selectedBudgets: null,
      mappings: {},
    });
    await writeFile(filePath, '{invalid', 'utf8');

    await expect(store.getSelectedBudgets()).rejects.toThrow();
    expect(await readFile(filePath, 'utf8')).toBe('{invalid');
  });

  test('rejects invalid mappings and selected budgets', async () => {
    const { store } = await createStore();

    await expect(store.saveMapping({ nope: true })).rejects.toThrow('invalid format');
    await expect(store.saveSelectedBudgets({ leftPlanId: 'same', rightPlanId: 'same' }))
      .rejects.toThrow('invalid');
  });
});
