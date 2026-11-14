import { describe, expect, test } from 'vitest';
import { currentMonthKey, monthFromPath, pathForMonth, pathForView, resolveMonth, viewFromPath } from './routes.js';

describe('month routes', () => {
  test('parses /budget/YYYYMM into a month key', () => {
    expect(monthFromPath('/budget/202610')).toBe('2026-10-01');
    expect(monthFromPath('/budget/202610/')).toBe('2026-10-01');
  });

  test('ignores paths that are not a valid month', () => {
    for (const path of ['/', '/budget', '/budget/202613', '/budget/202600', '/budget/2026-10', '/other/202610']) {
      expect(monthFromPath(path)).toBeNull();
    }
  });

  test('uses no path for the current month and /budget/YYYYMM otherwise', () => {
    expect(pathForMonth(currentMonthKey())).toBe('/');
    expect(pathForMonth('1999-03-01')).toBe('/budget/199903');
  });
});

describe('resolveMonth', () => {
  const shared = ['2026-06-01', '2026-05-01'];

  test('prefers a shared month from the URL', () => {
    expect(resolveMonth('/budget/202605', shared)).toBe('2026-05-01');
  });

  test('falls back to the latest shared month when the requested month is unavailable', () => {
    expect(resolveMonth('/budget/202001', shared)).toBe('2026-06-01');
    expect(resolveMonth('/', shared)).toBe('2026-06-01');
  });

  test('defaults to the current month when it is shared', () => {
    expect(resolveMonth('/', [currentMonthKey(), ...shared])).toBe(currentMonthKey());
  });

  test('returns an empty month when nothing is shared', () => {
    expect(resolveMonth('/', [])).toBe('');
  });
});

describe('view routes', () => {
  test('maps settings paths to views and everything else to the budget', () => {
    expect(viewFromPath('/settings')).toBe('settings');
    expect(viewFromPath('/settings/')).toBe('settings');
    expect(viewFromPath('/settings/map')).toBe('mapping');
    for (const path of ['/', '/budget/202610', '/settings/other', '/nope']) {
      expect(viewFromPath(path)).toBe('budget');
    }
  });

  test('builds paths for each view', () => {
    expect(pathForView('settings', '1999-03-01')).toBe('/settings');
    expect(pathForView('mapping', '1999-03-01')).toBe('/settings/map');
    expect(pathForView('budget', '1999-03-01')).toBe('/budget/199903');
    expect(pathForView('budget', '')).toBe('/');
  });
});
