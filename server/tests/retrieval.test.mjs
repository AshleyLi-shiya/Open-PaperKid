import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildIndex, searchIndex, searchKeywords, clearIndexes } from '../dist/server/src/services/rag.js';
import { createClientFor, resolveProvider } from '../dist/server/src/services/llm.js';
import { findSection } from '../dist/server/src/services/summarize.js';
import { truncateByTokens } from '../dist/server/src/utils/chunk.js';

const paper = { metadata: { id: 'retrieval-fixture', sections: [
  { title: 'Approach', text: 'A watering robot moves water to the roots. 自动浇水帮助植物生长。' },
  { title: 'Evaluation', text: 'The roots grew longer with water.' },
  { title: 'References', text: 'Unrelated unicorns.' },
] }, fullText: '' };

test('keyword fallback searches body in English and Chinese without references', () => {
  assert.equal(searchKeywords(paper, 'watering robot')[0].sectionTitle, 'Approach');
  assert.equal(searchKeywords(paper, '自动浇水')[0].sectionTitle, 'Approach');
  assert.equal(searchKeywords(paper, 'unicorns').length, 0);
  assert.match(findSection(paper, 'Method'), /watering/);
  assert.match(findSection(paper, 'Experiments'), /longer/);
  assert.ok(truncateByTokens('中'.repeat(100), 20).length <= 20);
});

test('indexes are isolated by embedding identity and invalidated on dimension changes', async () => {
  const a = { embeddingKey: 'model-a', embed: async texts => texts.map(() => [1, 0]) };
  const b = { embeddingKey: 'model-b', embed: async texts => texts.map(() => [1, 0, 1]) };
  await buildIndex(paper, a);
  assert.equal((await searchIndex(paper.metadata.id, 'water', b)).length, 0);
  await buildIndex(paper, b);
  assert.ok((await searchIndex(paper.metadata.id, 'water', a)).length);
  assert.ok((await searchIndex(paper.metadata.id, 'water', b)).length);
  await assert.rejects(searchIndex(paper.metadata.id, 'water', { ...a, embed: b.embed }), /changed/);
  assert.equal((await searchIndex(paper.metadata.id, 'water', a)).length, 0);
  clearIndexes(paper.metadata.id);
  assert.equal((await searchIndex(paper.metadata.id, 'water', b)).length, 0);
  await assert.rejects(buildIndex(paper, { ...a, embed: async () => [[NaN]] }), /Invalid/);
});

test('embedding identity excludes credentials and distinguishes endpoints', () => {
  const client = baseUrl => createClientFor(resolveProvider({ provider: 'openai', apiKey: 'test-secret', baseUrl }));
  assert.notEqual(client('https://one.invalid/v1').embeddingKey, client('https://two.invalid/v1').embeddingKey);
  assert.ok(!client('https://one.invalid/v1').embeddingKey.includes('test-secret'));
});
