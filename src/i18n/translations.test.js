import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { describe, expect, it } from 'vitest';
import { translations } from './translations';

const flattenKeys = (value, prefix = '') => {
  if (Array.isArray(value)) {
    return value.flatMap((child, index) => flattenKeys(child, `${prefix}[${index}]`));
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, child]) => (
      flattenKeys(child, prefix ? `${prefix}.${key}` : key)
    ));
  }
  return [prefix];
};

const collectEmptyValues = (value, prefix = '') => {
  if (typeof value === 'string') return value.trim() ? [] : [prefix];
  if (Array.isArray(value)) {
    return value.flatMap((child, index) => collectEmptyValues(child, `${prefix}[${index}]`));
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, child]) => (
      collectEmptyValues(child, prefix ? `${prefix}.${key}` : key)
    ));
  }
  return value === null || value === undefined ? [prefix] : [];
};

const collectStringValues = (value, prefix = '', result = new Map()) => {
  if (typeof value === 'string') {
    result.set(prefix, value);
    return result;
  }
  const entries = Array.isArray(value) ? value.entries() : Object.entries(value || {});
  for (const [key, child] of entries) {
    const childPath = Array.isArray(value)
      ? `${prefix}[${key}]`
      : prefix ? `${prefix}.${key}` : String(key);
    collectStringValues(child, childPath, result);
  }
  return result;
};

const getCatalogValue = (catalog, key) => (
  key.split('.').reduce((current, segment) => current?.[segment], catalog)
);

const listSourceFiles = (directory) => readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
  const entryPath = path.join(directory, entry.name);
  if (entry.isDirectory()) return listSourceFiles(entryPath);
  return /\.[cm]?[jt]sx?$/.test(entry.name) ? [entryPath] : [];
});

const sourceRoot = path.join(process.cwd(), 'src');

describe('translation catalogs', () => {
  it('keeps Turkish and English key structures identical', () => {
    expect(flattenKeys(translations.en).sort()).toEqual(flattenKeys(translations.tr).sort());
  });

  it.each(['tr', 'en'])('does not contain empty %s translations', (language) => {
    expect(collectEmptyValues(translations[language])).toEqual([]);
  });

  it('defines every statically referenced translation key', () => {
    const referencedKeys = new Set();
    for (const file of listSourceFiles(sourceRoot)) {
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(/\bt\(\s*['"]([^'"]+)['"]/g)) {
        referencedKeys.add(match[1]);
      }
    }

    const missingKeys = [...referencedKeys].filter(key => (
      getCatalogValue(translations.tr, key) === undefined
      || getCatalogValue(translations.en, key) === undefined
    ));
    expect(missingKeys.sort()).toEqual([]);
  });

  it('keeps interpolation placeholders identical between languages', () => {
    const turkishValues = collectStringValues(translations.tr);
    const englishValues = collectStringValues(translations.en);
    const mismatches = [];

    for (const [key, turkishValue] of turkishValues) {
      const englishValue = englishValues.get(key) || '';
      const turkishPlaceholders = [...turkishValue.matchAll(/{{\s*([^}\s]+)\s*}}/g)]
        .map(match => match[1]).sort();
      const englishPlaceholders = [...englishValue.matchAll(/{{\s*([^}\s]+)\s*}}/g)]
        .map(match => match[1]).sort();
      if (JSON.stringify(turkishPlaceholders) !== JSON.stringify(englishPlaceholders)) {
        mismatches.push(key);
      }
    }

    expect(mismatches).toEqual([]);
  });
});
