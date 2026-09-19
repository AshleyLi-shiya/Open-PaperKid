import { getUserConfig, setUserConfig, clearApiKey, listProviders, validateProvider } from "../lib/apiClient.js";
import { messages, normalizeLanguage } from "./i18n.js";

const $ = id => document.getElementById(id);
let language = "en";
let providers = [];
let status = null;
let languageWrite = Promise.resolve();
const t = () => messages[language];

function renderStatus() {
  const el = $("testStatus");
  el.className = status ? `status ${status.kind}` : "";
  el.textContent = status ? `${t()[status.key]}${status.detail ? " · " + status.detail : ""}` : "";
}

function showStatus(key, kind = "", detail = "") {
  status = { key, kind, detail };
  renderStatus();
}

function errorDetail(e) {
  // The shared client also serves the Chinese popup; translate its connectivity
  // wrapper here while preserving actual provider error details.
  return /无法连接|Failed to fetch/.test(e?.message || "") ? t().offline : (e?.message || "");
}

function renderProviderHints() {
  const p = $("provider").value;
  const spec = providers.find(x => x.id === p);
  if (!spec) return;
  $("providerHint").textContent = t().descriptions[p] || spec.description || "";
  $("modelHint").textContent = `${t().recommended}: ${spec.recommendedModel}. ${t().available}: ${(spec.suggestedModels || []).join(", ") || t().useRecommended}`;
  $("apiKeyRequired").style.display = spec.needsApiKey ? "inline" : "none";
  // All OpenAI-compatible providers support a custom endpoint.
  const showBase = p !== "anthropic";
  for (const id of ["baseUrlLabel", "baseUrl", "baseUrlHint"]) $(id).style.display = showBase ? "block" : "none";
}

function renderLanguage() {
  document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
  document.title = t().title;
  $("uiLanguage").value = language;
  for (const el of document.querySelectorAll("[data-i18n]")) el.textContent = t()[el.dataset.i18n];
  $("model").placeholder = t().modelPlaceholder;
  $("toggleVis").textContent = $("apiKey").type === "password" ? t().show : t().hide;
  for (const opt of $("provider").options) {
    const spec = providers.find(p => p.id === opt.value);
    opt.textContent = `${t().labels[opt.value] || spec.label}${spec.needsApiKey ? "" : " · " + t().noKey}`;
  }
  renderProviderHints();
  renderStatus();
}

async function loadForm() {
  const c = await getUserConfig();
  language = normalizeLanguage(c.uiLanguage);
  renderLanguage();
  providers = await listProviders();
  const sel = $("provider");
  sel.innerHTML = "";
  for (const p of providers) {
    const opt = document.createElement("option");
    opt.value = p.id;
    sel.appendChild(opt);
  }
  sel.value = c.provider || "openai";
  $("apiBase").value = c.apiBase || "http://localhost:5174";
  $("apiKey").value = c.apiKey || "";
  $("baseUrl").value = c.baseUrl || "";
  $("model").value = c.model || "";
  renderLanguage();
}

$("uiLanguage").addEventListener("change", () => {
  language = normalizeLanguage($("uiLanguage").value);
  renderLanguage();
  const selected = language;
  // Persist only the language: switching must not save unfinished form edits.
  languageWrite = languageWrite.catch(() => {}).then(() => setUserConfig({ uiLanguage: selected }));
  languageWrite.catch(e => showStatus("saveFailed", "err", errorDetail(e)));
});

$("provider").addEventListener("change", renderProviderHints);
$("toggleVis").addEventListener("click", () => {
  $("apiKey").type = $("apiKey").type === "password" ? "text" : "password";
  $("toggleVis").textContent = $("apiKey").type === "password" ? t().show : t().hide;
});

async function saveForm() {
  await languageWrite;
  await setUserConfig({
    apiBase: $("apiBase").value.trim() || "http://localhost:5174",
    provider: $("provider").value,
    apiKey: $("apiKey").value.trim(),
    baseUrl: $("baseUrl").value.trim(),
    model: $("model").value.trim(),
    uiLanguage: language,
  });
}

$("saveBtn").addEventListener("click", async () => {
  try { await saveForm(); showStatus("saved", "ok"); }
  catch (e) { showStatus("saveFailed", "err", errorDetail(e)); }
});

$("clearBtn").addEventListener("click", async () => {
  try {
    await languageWrite;
    await clearApiKey();
    $("apiKey").value = "";
    showStatus("cleared", "ok");
  } catch (e) { showStatus("saveFailed", "err", errorDetail(e)); }
});

$("testBtn").addEventListener("click", async () => {
  $("testBtn").disabled = true;
  try {
    await saveForm();
    showStatus("testing");
    const r = await validateProvider();
    showStatus(r.ok ? "success" : "failure", r.ok ? "ok" : "err",
      r.ok ? `${r.provider} · ${r.model} · ${r.latencyMs}ms` : errorDetail({ message: r.error }));
  } catch (e) { showStatus("failure", "err", errorDetail(e)); }
  finally { $("testBtn").disabled = false; }
});

loadForm().catch(e => showStatus("loadFailed", "err", errorDetail(e)));
