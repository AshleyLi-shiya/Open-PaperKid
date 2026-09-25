# Does the explanation actually help?

No live-model quality benchmark has been completed for this revision.
Automated tests use synthetic fixtures and mock responses; they do not prove readability or accuracy.
Do not present mock output as a real paper demo.

## Small, reproducible reader trial

Recruit 5–10 consenting adult readers who are interested in AI but unfamiliar with the chosen papers.
Use three public papers they genuinely want to understand: one standard layout, one nonstandard layout,
and one with important numerical results or limitations.

For each run, record the paper URL, commit, model, endpoint type (never the key), language,
request duration, retrieval mode and unedited output. Store public, permission-safe material only.

Compare PaperKid with a plain summary from the same model and source excerpts.
Randomize which explanation readers see first; avoid showing the same paper twice to the same reader
when comparing comprehension, since the first explanation teaches them the answer.

Ask readers to:
- Explain the main idea in their own words.
- Describe one step in how the method works.
- Name one limitation or unanswered question.
- Point to the sentence they still do not understand.

Have a knowledgeable reviewer check factual claims against the original paper.
Record omissions, unsupported numbers and analogies mistaken for facts, not just sentence length.
Report sample size and failures alongside any improvement; do not infer a validated child reading age from adult feedback.

## Honest demo checklist

- Show import, language selection, actual output and a follow-up question.
- Keep any wait-time edits clearly labeled.
- Include a source excerpt and a limitation, not only the best sentence.
- Hide API keys and account information before recording.
- Publish raw outputs with model and paper details so others can reproduce them.

## Product signals

Track, with participant consent, whether they can finish setup, generate a first useful answer,
and choose to return for a second paper. Ask where they stopped.
GitHub views, clones and stars measure different actions; none alone proves repeat usage.
No analytics or tracking is added to the extension by this checklist.
