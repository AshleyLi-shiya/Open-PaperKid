import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const read = name => readFile(new URL('../chrome-extension/' + name, import.meta.url), 'utf8');

test('manifest content scripts execute as classic scripts and click delegates without fetch', async () => {
  const manifest = JSON.parse(await read('manifest.json'));
  let button, message;
  const context = { URL, location: { href: 'https://arxiv.org/abs/2401.12345' }, alert: assert.fail,
    chrome: { runtime: { sendMessage: async msg => { message = msg; return { ok: true }; } } },
    document: { readyState: 'complete', getElementById: () => null, createElement: () => ({ style: {}, addEventListener: (_, fn) => button = fn }), body: { appendChild() {} } } };
  for (const script of manifest.content_scripts.flatMap(s => s.js)) new vm.Script(await read(script)).runInNewContext(context);
  await button();
  assert.equal(message.type, 'PK_OPEN_PAPER');
  assert.equal(message.arxivId, '2401.12345');
});

test('worker opens panel immediately, queues import once, and retains results after restart', async () => {
  const code = await read('background/background.js');
  const stored = {}; let listener, opened = false;
  const chrome = {
    sidePanel: { open: () => { opened = true; return Promise.resolve(); } },
    storage: { session: { set: async data => Object.assign(stored, data), get: async () => stored } },
    runtime: { onMessage: { addListener: fn => listener = fn }, onInstalled: { addListener() {} }, sendMessage: async () => {} },
    contextMenus: { onClicked: { addListener() {} } },
  };
  vm.runInNewContext(code, { chrome, console });
  const send = msg => new Promise(resolve => listener(msg, { tab: { id: 1 } }, resolve));
  const opening = send({ type: 'PK_OPEN_PAPER', arxivId: '2401.12345' });
  assert.equal(opened, true); await opening;
  assert.equal((await send({ type: 'PK_TAKE_IMPORT' })).arxivId, '2401.12345');
  assert.equal((await send({ type: 'PK_TAKE_IMPORT' })).arxivId, null);
  await send({ type: 'PK_RESULT', payload: { paper: { id: 'p' }, summary: null } });
  vm.runInNewContext(code, { chrome, console });
  assert.equal((await send({ type: 'PK_GET_STATE' })).paper.id, 'p');
});

test('API client invalidates cached settings when changed in another extension page', async () => {
  let onChanged; let config = { apiKey: 'first-test-key' };
  const chrome = { storage: { onChanged: { addListener: fn => onChanged = fn }, local: { get: async () => ({ paperkidConfig: config }) } } };
  const code = (await read('lib/apiClient.js')).replaceAll('export ', '');
  const context = vm.createContext({ chrome }); vm.runInContext(code, context);
  assert.equal((await vm.runInContext('getUserConfig()', context)).apiKey, 'first-test-key');
  config = { apiKey: 'second-test-key' }; onChanged({ paperkidConfig: {} }, 'local');
  assert.equal((await vm.runInContext('getUserConfig()', context)).apiKey, 'second-test-key');
});
