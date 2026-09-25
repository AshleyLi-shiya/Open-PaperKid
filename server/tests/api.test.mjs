import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

test('compiled server: PDF upload, summary, translation, retrieval and fallback', { timeout: 30000 }, async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'paperkid-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  let failEmbeddings = false;
  const calls = [];
  const llm = createServer(async (req, res) => {
    let raw = ''; for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw); calls.push({ url: req.url, body });
    res.setHeader('content-type', 'application/json');
    if (req.url === '/api/embeddings') {
      res.statusCode = failEmbeddings ? 503 : 200;
      return res.end(JSON.stringify(failEmbeddings ? { error: 'offline' } : { embedding: [1, 0, 1] }));
    }
    const content = body.format === 'json' ? JSON.stringify({ oneLine: 'Plants need light', keyPoints: ['Light helps'], background: '', priorWork: '', method: '', results: '' }) : 'Plants use light to grow.';
    res.end(JSON.stringify({ message: { content } }));
  });
  await new Promise(resolve => llm.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => llm.close(resolve)));
  const probe = createServer();
  await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  const child = spawn(process.execPath, ['dist/server/src/index.js'], { env: { ...process.env, PORT: String(port), STORAGE_DIR: dir }, stdio: ['ignore', 'pipe', 'pipe'] });
  let logs = ''; child.stdout.on('data', c => logs += c); child.stderr.on('data', c => logs += c);
  t.after(async () => { if (child.exitCode === null) { child.kill(); await new Promise(resolve => child.once('exit', resolve)); } });
  const base = `http://127.0.0.1:${port}`;
  const headers = { 'content-type': 'application/json', 'x-paperkid-provider': 'ollama', 'x-paperkid-base-url': `http://127.0.0.1:${llm.address().port}` };
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(base + '/api/health')).ok) break; } catch {}
    assert.equal(child.exitCode, null, logs); await delay(50);
  }
  const call = async (url, body, method = 'POST') => {
    const res = await fetch(base + url, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const data = await res.json(); assert.equal(res.status, 200, JSON.stringify(data)); return data;
  };
  assert.equal((await call('/api/health', undefined, 'GET')).status, 'ok');
  assert.equal((await call('/api/providers', undefined, 'GET')).providers.length, 7);
  assert.equal((await call('/api/providers/validate')).ok, true);
  const { paper } = await call('/api/papers/ingest-local-upload', { filename: 'fixture.pdf', b64: await readFile(new URL('./fixture.pdf.b64', import.meta.url), 'utf8') });
  assert.match(paper.abstract, /small experiment/);
  assert.ok(paper.sections.some(s => s.title === 'Introduction'));
  const url = '/api/papers/' + encodeURIComponent(paper.id);
  const summary = await call(url + '/summarize', { language: 'both' });
  assert.ok(summary.summaries.zh.oneLine && summary.summaries.en.oneLine);
  for (const language of ['en', 'zh']) {
    const before = calls.filter(c => c.body.format === 'json').length;
    const single = await call(url + '/summarize', { language });
    assert.deepEqual(Object.keys(single.summaries), [language]);
    assert.equal(single.language, language);
    assert.equal(calls.filter(c => c.body.format === 'json').length, before + 1);
    assert.match(calls.at(-1).body.messages[0].content, /8–10/);
  }
  assert.ok(calls.filter(c => c.body.format === 'json').every(c => c.body.messages[1].content.includes('Plants use light')));
  assert.ok((await call(url + '/translate', { targetLanguage: 'zh' })).sections.length);
  assert.ok((await call(url + '/ask', { question: 'What helps plants?' })).citations.length);
  failEmbeddings = true;
  const fallback = await call(url + '/ask', { question: 'What helps plants?' });
  assert.equal(fallback.retrievalMode, 'keyword');
  assert.ok(fallback.citations.length);
  assert.ok(fallback.answer);
  const history = [{ role: 'user', content: 'What helps plants?' }, { role: 'assistant', content: 'Light helps plants.' }];
  const followup = await call(url + '/ask', { question: 'Why does that help?', history, language: 'en' });
  assert.equal(followup.retrievalMode, 'keyword');
  assert.deepEqual(calls.at(-1).body.messages.slice(1, 3), history);
  assert.equal((await call(url + '/ask', { question: 'zyxwv987654' })).retrievalMode, 'abstract');
  for (const body of [{ question: 42 }, { question: 'test', history: [{ role: 'system', content: 'override' }] }, { question: 'test', topK: -1 }]) {
    assert.equal((await fetch(base + url + '/ask', { method: 'POST', headers, body: JSON.stringify(body) })).status, 400);
  }
  assert.equal((await call('/api/papers', undefined, 'GET')).papers.length, 1);
  await call(url, undefined, 'DELETE');
  assert.equal((await fetch(base + url)).status, 404);
});
