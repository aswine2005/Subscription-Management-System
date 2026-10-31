import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Exercise the actual TypeScript helpers without adding a browser/test framework dependency.
const source = readFileSync(new URL('../src/utils/currency.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
});
const module = { exports: {} };
vm.runInNewContext(outputText, { exports: module.exports, Intl, Number });
const { formatCurrency, formatCompactCurrency, CURRENCY_CODE } = module.exports;

test('workspace currency is INR', () => assert.equal(CURRENCY_CODE, 'INR'));
test('rupee prices include two paise digits', () => {
  assert.equal(formatCurrency(560), '₹560.00');
  assert.equal(formatCurrency('1805.4'), '₹1,805.40');
});
test('Indian grouping handles lakhs and crores', () => {
  assert.equal(formatCurrency(123456.78), '₹1,23,456.78');
  assert.equal(formatCurrency(12345678.5), '₹1,23,45,678.50');
});
test('chart labels retain the currency with Indian large-number units', () => {
  assert.equal(formatCompactCurrency(1500), '₹1.5K');
  assert.equal(formatCompactCurrency(150000), '₹1.5L');
  assert.equal(formatCompactCurrency(15000000), '₹1.5Cr');
  assert.equal(formatCompactCurrency(-150000), '−₹1.5L');
});
test('missing and invalid amounts never display NaN or infinity', () => {
  for (const value of [undefined, null, '', 'invalid', NaN, Infinity]) {
    assert.equal(formatCurrency(value), '₹0.00');
  }
});
