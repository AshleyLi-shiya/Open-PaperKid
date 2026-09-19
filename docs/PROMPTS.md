# Prompt 调优示例

`server/src/prompts/index.ts` 集中维护所有 prompt。下面是几条常用调优场景：

## 1. 想要总结"再简单一点"（比如给中学生）

修改 `SIMPLE_LANGUAGE_RULES`：

```ts
export const SIMPLE_LANGUAGE_RULES = `
- 像给小学三年级的学生解释一样写。
- 每个专业术语必须先给一个生活里的比喻,再写术语原文。
- 中文句子不超过 15 个字。
- ...
`;
```

## 2. 想要"专家版"双语

修改 `summaryPrompt`，把 `SIMPLE_LANGUAGE_RULES` 替换成：

```ts
const system = isZh
  ? `你是一名学术编辑,请用精确的中文学术语言总结这篇论文,保留所有专业术语。`
  : `You are an academic editor. Summarize the paper in precise English academic language, preserving all technical terms.`;
```

## 3. 想要总结额外加一个"局限性"维度

在 `summaryPrompt` 的 system prompt JSON schema 里加一项：

```ts
"limitations": "这篇论文自己承认的不足或留待未来解决的问题(不超过 80 字)"
```

并在 `coerceSummary` 里补：

```ts
limitations: String((r as any).limitations ?? ""),
```

## 4. 翻译加"风格"参数

在 `translatePrompt` 里加：

```ts
const system = isZh
  ? `... 要求风格:${args.style ?? "academic"} (academic|popular|technical)`
  : `... Style: ${args.style ?? "academic"} (academic|popular|technical)`;
```

并在 `translate` 函数里接受 `style` 透传。

## 5. 问答加"必须引用"

在 `qaPrompt` 的 system 部分强调：

```ts
- 每个数字或具体事实,必须以 [来源: section_title] 结尾,否则不算合格答案。
```

## 6. A/B 测试

最快的方式：fork `SIMPLE_LANGUAGE_RULES`，加 `V2 = '...'`，

```ts
const RULES = process.env.PROMPT_VARIANT === "v2" ? V2 : SIMPLE_LANGUAGE_RULES;
```

通过环境变量切换 prompt 版本，无需改代码。

## 7. prompt 调试

`POST /api/papers/:id/summarize` 出错时，临时把 `json: true` 改成 `json: false` 让 LLM 自由输出，方便排查 schema 问题（见 `summarize.ts` 的 `safeParseJson` 容错逻辑）。