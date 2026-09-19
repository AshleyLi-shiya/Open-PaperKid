// Bilingual simple-language prompt templates.
// Goal: any 12-year-old can read and understand the output.
// We forbid jargon without an in-line plain-language gloss.

export const SIMPLE_LANGUAGE_RULES = `
# 输出语言要求（必须遵守）
- 像给小学高年级的学生解释一样写。
- 每个专业术语第一次出现时,用"通俗解释(术语原文)"的格式给一个白话解释。
- 避免堆砌名词缩写。如果一个缩写不重要,直接展开说。
- 句子尽量短(中文不超过 30 字,英文不超过 20 个单词)。
- 不要写"本文"、"我们"、"作者"——用"这篇论文"或"研究者"。
- 不要写营销腔("颠覆性"、"革命性"、"开创性"等)。
- 不要重复论文原句,要重新用简单的话讲。
`;

/**
 * Summary prompt. Built on a 4-canonical-question structure
 * (background / prior work / method / results) with simple-language rules applied.
 *
 * Returns JSON for reliable parsing.
 */
export function summaryPrompt(args: {
  title: string;
  abstract: string;
  intro: string;
  method: string;
  experiments: string;
  conclusion: string;
  language: "zh" | "en";
}): { system: string; user: string } {
  const isZh = args.language === "zh";

  const system = isZh
    ? `你是一名擅长把学术论文讲给小学生听的科普老师。${SIMPLE_LANGUAGE_RULES}

请基于用户提供的论文片段,产出**严格的 JSON 对象**:
{
  "oneLine": "一句话总结这篇论文做了什么(给完全没读过论文的人听)",
  "keyPoints": ["关键点1", "关键点2", "关键点3", "关键点4", "关键点5"],
  "background": "这篇论文要解决的问题是什么?为什么这事儿重要?(不超过 80 字)",
  "priorWork": "之前的研究者是怎么做的?有哪些不足?(不超过 80 字)",
  "method": "这篇论文的核心方法是什么?用生活里的比喻说清楚(不超过 120 字)",
  "results": "这篇论文的效果怎么样?用大白话说出数字的意义(不超过 120 字)",
  "verifyNumbers": ["需要读者自己去原论文确认的具体数字或参数(可以是空数组)"]
}

只输出 JSON,不要包含其他内容。`
    : `You are a science teacher explaining a research paper to a smart 12-year-old. ${SIMPLE_LANGUAGE_RULES}

Based on the paper excerpts provided, produce a STRICT JSON object:
{
  "oneLine": "One-sentence summary, written for someone who has never read this paper",
  "keyPoints": ["key point 1", "key point 2", "key point 3", "key point 4", "key point 5"],
  "background": "What problem does the paper solve? Why does it matter? (max 80 words)",
  "priorWork": "What did previous researchers do? What was missing? (max 80 words)",
  "method": "What is the core method? Explain with an everyday-life analogy (max 120 words)",
  "results": "How well did it work? Explain the numbers in plain language (max 120 words)",
  "verifyNumbers": ["specific numbers/parameters the reader should double-check (can be empty)"]
}

Output only the JSON object, nothing else.`;

  const user = isZh
    ? `论文标题:${args.title}

摘要(Abstract):
${args.abstract || "(缺失)"}

引言(Introduction):
${args.intro || "(缺失)"}

方法(Method):
${args.method || "(缺失)"}

实验(Experiments):
${args.experiments || "(缺失)"}

结论(Conclusion):
${args.conclusion || "(缺失)"}

请按要求产出 JSON。`
    : `Title: ${args.title}

Abstract:
${args.abstract || "(missing)"}

Introduction:
${args.intro || "(missing)"}

Method:
${args.method || "(missing)"}

Experiments:
${args.experiments || "(missing)"}

Conclusion:
${args.conclusion || "(missing)"}

Produce the JSON as specified.`;

  return { system, user };
}

export function translatePrompt(args: {
  text: string;
  targetLanguage: "zh" | "en";
  context?: string;
}): { system: string; user: string } {
  const isZh = args.targetLanguage === "zh";
  const system = isZh
    ? `你是一名学术翻译,把英文论文段落译成自然、顺口的中文。${SIMPLE_LANGUAGE_RULES}

要求:
- 保留学术准确性,但允许为可读性做小幅意译。
- 专业术语首次出现时,格式:"中文译名(英文原文)"。
- 不要逐字死翻,也不要漏译。
- 保留原段落结构(段落、列表、引用标记)。`
    : `You are an academic translator. Translate Chinese paper passages into clear, natural English. ${SIMPLE_LANGUAGE_RULES}

Requirements:
- Preserve academic accuracy, but allow minor paraphrasing for readability.
- First occurrence of a term: format "English term (original Chinese)".
- Do not translate word-by-word; do not omit content.
- Preserve paragraph / list / citation structure.`;

  const user = `${args.context ? `Context: ${args.context}\n\n` : ""}Translate the following text:\n\n${args.text}`;
  return { system, user };
}

export function qaPrompt(args: {
  question: string;
  context: string;
  language: "zh" | "en";
}): { system: string; user: string } {
  const isZh = args.language === "zh";
  const system = isZh
    ? `你是论文问答助手。${SIMPLE_LANGUAGE_RULES}

根据"已知论文片段"回答用户问题。
- 如果已知片段里有答案,用简单的话复述;引用具体细节时,说明它出自哪一段。
- 如果已知片段里没有答案,直接说"这个问题在提供的论文片段里没有直接证据,我无法回答",不要编造。
- 回答中每个数字或具体结论,后面用 [来源: ...] 标注它出自哪一段。`
    : `You are a paper Q&A assistant. ${SIMPLE_LANGUAGE_RULES}

Answer the user's question based ONLY on the "Paper excerpts" provided.
- If the answer is in the excerpts, restate it simply; cite which section.
- If not, say "I cannot answer this from the provided excerpts" — never invent.
- For every concrete number or claim, add [source: section] after it.`;

  const user = isZh
    ? `已知论文片段:
${args.context}

问题:${args.question}

请回答。`
    : `Paper excerpts:
${args.context}

Question: ${args.question}

Answer:`;

  return { system, user };
}