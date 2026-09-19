import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const read = name => readFile(new URL('../chrome-extension/' + name, import.meta.url), 'utf8');
function dom(html) {
  const elements = {};
  function element() {
    return { value: '', type: 'password', style: {}, options: [], children: [], listeners: {},
      addEventListener(name, fn) { this.listeners[name] = fn; },
      appendChild(child) { this.children.push(child); this.options.push(child); },
      set innerHTML(value) { this.html = value; this.children = []; }, get innerHTML() { return this.html; } };
  }
  for (const match of html.matchAll(/id="([^"]+)"/g)) elements[match[1]] = element();
  const labels = [...html.matchAll(/data-i18n="([^"]+)"/g)].map(m => ({ dataset: { i18n: m[1] } }));
  return { elements, document: { documentElement: {}, getElementById: id => elements[id], createElement: element, querySelectorAll: () => labels } };
}

test('settings default to English and persist Chinese without changing provider credentials', async () => {
  let config = { provider: 'qwen', apiKey: 'test-only-key', model: 'test-model' };
  async function load() {
    const { elements, document } = dom(await read('options/options.html'));
    const context = vm.createContext({ document,
      getUserConfig: async () => ({ ...config }),
      setUserConfig: async patch => { config = { ...config, ...patch }; },
      clearApiKey: async () => {}, validateProvider: async () => ({ ok: true, provider: 'qwen', model: 'test-model', latencyMs: 1 }),
      listProviders: async () => [{ id: 'qwen', label: 'Qwen', needsApiKey: true, recommendedModel: 'test-model' }] });
    await vm.runInContext((await read('options/i18n.js')).replaceAll('export ', '') + '\n' + (await read('options/options.js')).replace(/^import .*;\n/gm, ''), context);
    return { elements, document, context };
  }
  let page = await load();
  assert.equal(page.document.documentElement.lang, 'en');
  page.elements.uiLanguage.value = 'zh'; page.elements.uiLanguage.listeners.change();
  await vm.runInContext('languageWrite', page.context);
  assert.equal(config.uiLanguage, 'zh');
  assert.equal(config.apiKey, 'test-only-key');
  assert.equal(config.model, 'test-model');
  page = await load();
  assert.equal(page.document.documentElement.lang, 'zh-CN');
  page.elements.uiLanguage.value = 'en'; page.elements.uiLanguage.listeners.change();
  await vm.runInContext('languageWrite', page.context);
  await page.elements.saveBtn.listeners.click();
  assert.match(page.elements.testStatus.textContent, /Saved/i);
});

test('panel generates only selected language, renders one legacy language, and ignores stale requests', async () => {
  const html = await read('sidepanel/sidepanel.html');
  assert.ok(html.indexOf('summarize in English') < html.indexOf('中文总结'));
  const { elements, document } = dom(html);
  const pending = []; const sent = [];
  const result = lang => ({ language: lang, summaries: { [lang]: { oneLine: lang, keyPoints: [] } } });
  const paper = { id: 'test-paper', title: 'Plants' };
  const context = vm.createContext({ document, ask: async () => {}, getUserConfig: async () => ({ provider: 'ollama' }), ingestArxiv: async () => ({ paper }),
    summarize: (id, lang) => new Promise(resolve => pending.push({ id, lang, resolve })),
    chrome: { runtime: { onMessage: { addListener() {} }, sendMessage: async msg => {
      sent.push(msg);
      if (msg.type === 'PK_GET_STATE') return {};
      if (msg.type === 'PK_TAKE_IMPORT') return { arxivId: 'test-arxiv' };
    } } } });
  await vm.runInContext((await read('sidepanel/sidepanel.js')).replace(/^import .*;\n/gm, ''), context);
  assert.equal(pending.length, 0, 'import must not generate a bilingual summary');
  context.legacy = { paperId: paper.id, paper, kind: 'summary', summary: { language: 'both', summaries: { ...result('en').summaries, ...result('zh').summaries } } };
  vm.runInContext('showResult(legacy)', context);
  assert.equal(elements.summaryContainer.children.length, 1);
  assert.match(elements.summaryContainer.children[0].innerHTML, /English summary/);
  const english = elements.summaryEn.listeners.click();
  const chinese = elements.summaryZh.listeners.click();
  assert.deepEqual(pending.map(p => p.lang), ['en', 'zh']);
  pending[1].resolve(result('zh')); await chinese;
  pending[0].resolve(result('en')); await english;
  assert.equal(elements.summaryContainer.children.length, 1);
  assert.match(elements.summaryContainer.children[0].innerHTML, /中文总结/);
  assert.equal(sent.filter(m => m.payload?.summary).length, 1);
});
