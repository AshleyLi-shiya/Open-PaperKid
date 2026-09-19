import {
  getUserConfig,
  setUserConfig,
  clearApiKey,
  listProviders,
  validateProvider,
  setApiBase,
} from "../lib/apiClient.js";

const $ = (id) => document.getElementById(id);

let _providers = [];

function renderProviderHints() {
  const p = $("provider").value;
  const spec = _providers.find((x) => x.id === p);
  if (!spec) return;
  $("providerHint").textContent = spec.description || "";
  $("modelHint").textContent = `推荐模型:${spec.recommendedModel}。可用模型:${(spec.suggestedModels || []).join(", ") || "(留空使用推荐)"}`;
  if (spec.needsApiKey) {
    $("apiKeyRequired").style.display = "inline";
  } else {
    $("apiKeyRequired").style.display = "none";
  }
  // Show baseUrl only for ollama
  const showBase = p === "ollama";
  $("baseUrlLabel").style.display = showBase ? "block" : "none";
  $("baseUrl").style.display = showBase ? "block" : "none";
  $("baseUrlHint").style.display = showBase ? "block" : "none";
  if (showBase && spec.defaultBaseUrl && !$("baseUrl").value) {
    $("baseUrl").value = spec.defaultBaseUrl;
  }
}

async function loadForm() {
  _providers = await listProviders();
  const c = await getUserConfig();

  $("apiBase").value = c.apiBase || "";
  const sel = $("provider");
  sel.innerHTML = "";
  for (const p of _providers) {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = `${p.label}${p.needsApiKey ? "" : " · 免 Key"}`;
    sel.appendChild(opt);
  }
  sel.value = c.provider || "openai";
  $("apiKey").value = c.apiKey || "";
  $("baseUrl").value = c.baseUrl || "";
  $("model").value = c.model || "";
  renderProviderHints();
}

$("provider").addEventListener("change", renderProviderHints);

$("toggleVis").addEventListener("click", () => {
  const inp = $("apiKey");
  if (inp.type === "password") {
    inp.type = "text";
    $("toggleVis").textContent = "隐藏";
  } else {
    inp.type = "password";
    $("toggleVis").textContent = "显示";
  }
});

$("saveBtn").addEventListener("click", async () => {
  await setApiBase($("apiBase").value.trim() || "http://localhost:5174");
  await setUserConfig({
    provider: $("provider").value,
    apiKey: $("apiKey").value.trim(),
    baseUrl: $("baseUrl").value.trim(),
    model: $("model").value.trim(),
  });
  const s = $("testStatus");
  s.className = "status ok";
  s.textContent = "已保存。点击 \"发送一次 ping 测试\" 验证连通性。";
});

$("clearBtn").addEventListener("click", async () => {
  await clearApiKey();
  $("apiKey").value = "";
  const s = $("testStatus");
  s.className = "status ok";
  s.textContent = "API Key 已清除。";
});

$("testBtn").addEventListener("click", async () => {
  // Save first so the latest config is what gets tested.
  await setApiBase($("apiBase").value.trim() || "http://localhost:5174");
  await setUserConfig({
    provider: $("provider").value,
    apiKey: $("apiKey").value.trim(),
    baseUrl: $("baseUrl").value.trim(),
    model: $("model").value.trim(),
  });

  const s = $("testStatus");
  s.className = "status";
  s.textContent = "正在发送测试请求…";
  try {
    const r = await validateProvider();
    if (r.ok) {
      s.className = "status ok";
      s.textContent = `✓ 连接成功 · ${r.provider} · ${r.model} · ${r.latencyMs}ms`;
    } else {
      s.className = "status err";
      s.textContent = `✗ 连接失败:${r.error}`;
    }
  } catch (e) {
    s.className = "status err";
    s.textContent = `✗ ${e.message}`;
  }
});

loadForm();