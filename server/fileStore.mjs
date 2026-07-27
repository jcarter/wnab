import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import {
  getMappingStorageKey,
  normalizeMapping,
  validateMappingShape,
} from '../src/domain/mappingStorage.js';

const DATA_VERSION = 3;
const DEFAULT_DATA = Object.freeze({
  version: DATA_VERSION,
  selectedBudgets: null,
  mappings: {},
});

function cloneDefaultData() {
  return structuredClone(DEFAULT_DATA);
}

function hasMappings(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function normalizeSelectedBudgets(selectedBudgets) {
  if (selectedBudgets === null) return null;
  if (
    !selectedBudgets ||
    typeof selectedBudgets !== 'object' ||
    typeof selectedBudgets.leftPlanId !== 'string' ||
    !selectedBudgets.leftPlanId ||
    typeof selectedBudgets.rightPlanId !== 'string' ||
    !selectedBudgets.rightPlanId ||
    selectedBudgets.leftPlanId === selectedBudgets.rightPlanId
  ) {
    throw new Error('The selected budgets have an invalid format.');
  }
  return {
    leftPlanId: selectedBudgets.leftPlanId,
    rightPlanId: selectedBudgets.rightPlanId,
  };
}

function normalizeData(data) {
  if (!data || typeof data !== 'object' || !hasMappings(data.mappings)) {
    throw new Error('The app data file has an invalid format.');
  }

  if (data.version === 1) {
    return {
      version: DATA_VERSION,
      selectedBudgets: null,
      mappings: data.mappings,
    };
  }

  if (data.version === 2) {
    return {
      version: DATA_VERSION,
      selectedBudgets: normalizeSelectedBudgets(data.selection),
      mappings: data.mappings,
    };
  }

  if (data.version !== DATA_VERSION) {
    throw new Error('The app data file has an invalid format.');
  }
  return {
    version: DATA_VERSION,
    selectedBudgets: normalizeSelectedBudgets(data.selectedBudgets),
    mappings: data.mappings,
  };
}

export class FileStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.operationQueue = Promise.resolve();
  }

  enqueue(operation) {
    const result = this.operationQueue.then(operation);
    this.operationQueue = result.catch(() => undefined);
    return result;
  }

  async readFromDisk() {
    try {
      const parsed = JSON.parse(await readFile(this.filePath, 'utf8'));
      const data = normalizeData(parsed);
      if (parsed.version !== DATA_VERSION) await this.writeToDisk(data);
      return data;
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
      const data = cloneDefaultData();
      await this.writeToDisk(data);
      return data;
    }
  }

  async writeToDisk(data) {
    const nextData = normalizeData(data);
    await mkdir(dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(nextData, null, 2)}\n`, {
      encoding: 'utf8',
      mode: 0o600,
    });
    await rename(temporaryPath, this.filePath);
  }

  read() {
    return this.enqueue(() => this.readFromDisk());
  }

  write(data) {
    return this.enqueue(() => this.writeToDisk(data));
  }

  async getMapping(planIds) {
    const data = await this.read();
    return data.mappings[getMappingStorageKey(planIds)] ?? null;
  }

  async saveMapping(mapping) {
    if (!validateMappingShape(mapping, mapping?.planIds ?? [])) {
      throw new Error('The mapping has an invalid format.');
    }
    const normalized = normalizeMapping(mapping);
    return this.enqueue(async () => {
      const data = await this.readFromDisk();
      data.mappings[getMappingStorageKey(normalized.planIds)] = normalized;
      await this.writeToDisk(data);
      return normalized;
    });
  }

  async getSelectedBudgets() {
    const data = await this.read();
    return structuredClone(data.selectedBudgets);
  }

  async saveSelectedBudgets(selectedBudgets) {
    const normalized = normalizeSelectedBudgets(selectedBudgets);
    return this.enqueue(async () => {
      const data = await this.readFromDisk();
      data.selectedBudgets = normalized;
      await this.writeToDisk(data);
      return structuredClone(normalized);
    });
  }
}
