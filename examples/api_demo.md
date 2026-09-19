# PaperKid 示例

## 论文总结（中英双语）

**请求**

```bash
curl -X POST http://localhost:5174/api/papers/ingest \
  -H 'content-type: application/json' \
  -d '{"arxivId":"2406.01234"}'

curl -X POST http://localhost:5174/api/papers/arxiv:2406.01234/summarize \
  -H 'content-type: application/json' \
  -d '{"language":"both"}'
```

**响应（示意，真实输出由本地 LLM 生成）**

```json
{
  "paperId": "arxiv:2406.01234",
  "language": "both",
  "summaries": {
    "zh": {
      "oneLine": "这篇论文提出了一种新的图像生成方法,让 AI 画出来的图更接近人手画的风格。",
      "keyPoints": [
        "过去画图 AI 生成的图像太光滑,缺少人手画的不规则感",
        "本文在训练时加入\"故意抖动\"的步骤,让 AI 学会模仿人类笔触",
        "在三个公开数据集上,人类评价员打分比之前最好的方法高出 27%",
        "推理速度比前作慢 1.4 倍,但效果提升明显",
        "代码开源,模型权重也公开"
      ],
      "background": "画图 AI 很擅长做出\"完美的\"图,但很多人更喜欢有人情味的手绘风格。这篇论文就是想解决\"太完美\"的问题。",
      "priorWork": "之前的方法大多在\"图像质量\"上做文章,比如更高分辨率、更逼真的纹理。但很少有工作专门研究怎么让图\"看起来像人画的\"。",
      "method": "想象一下:你教一个小孩学画画,如果只给他看完美的画,他永远学不会手绘的不规则感。本文作者在训练数据里\"故意加入\"抖动和笔触感,就像让 AI 看了 1000 张带草稿痕迹的画一样。",
      "results": "在用户调研中,这种新方法得到的\"像人画的\"评分比之前最好的方法高了 27%。不过生成速度慢了大约 40%。",
      "verifyNumbers": ["27% 是相对提升还是绝对提升", "1.4× 是哪种 GPU 上的测试"]
    },
    "en": {
      "oneLine": "...",
      "keyPoints": ["...", "..."],
      "background": "...",
      "priorWork": "...",
      "method": "...",
      "results": "...",
      "verifyNumbers": ["..."]
    }
  }
}
```

## 论文问答

**请求**

```bash
curl -X POST http://localhost:5174/api/papers/arxiv:2406.01234/ask \
  -H 'content-type: application/json' \
  -d '{"question":"作者用了哪些 baseline？","language":"zh"}'
```

**响应**

```json
{
  "paperId": "arxiv:2406.01234",
  "question": "作者用了哪些 baseline？",
  "answer": "作者主要跟三种方法做了比较:\n1. 之前最好的画图 AI (SD-XL),这是一个大规模商业模型 [来源: Experiments]\n2. 一个专门做风格化的方法 (StyleDrop) [来源: Experiments]\n3. 一个经典图像生成方法 [来源: Related Work]\n\n简单说,作者把新方法跟\"行业老大\"、\"风格化专家\"、\"老牌方法\"都做了对比,这种对比方式在 AI 论文里很常见。",
  "citations": [
    { "sectionTitle": "Experiments", "snippet": "...We compare against three baselines: SD-XL, StyleDrop, and the original Stable Diffusion..." },
    { "sectionTitle": "Related Work", "snippet": "...Classic image generation methods have focused on..." }
  ]
}
```