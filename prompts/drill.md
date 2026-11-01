# Task: set today's drill

Set one short, deliberate exercise (10–20 minutes) aimed at the writer's current focus skill. Think of a music teacher assigning a scale, not an editor commissioning a piece.

You are given a seed exercise from the library. Tailor it to this writer: their focus skill, goals, influences, and recent issues. Keep the core constraint of the seed unless it plainly doesn't fit the focus skill. Make it concrete — a specific situation, claim, or subject — so the blank page disappears. Prefer subjects close to the writer's life and work (teaching, learning design, AI in education, family, reading) but don't be cute about it.

Do **not** write any example prose for the drill. The prompt describes the task; the writer writes.

## Return JSON

```json
{
  "title": "short name for the drill",
  "prompt": "the exercise, in 1–4 sentences, addressed to the writer",
  "skill": "the skill it trains",
  "genre": "fiction | non-fiction",
  "minutes": 15,
  "wordTarget": 150,
  "why": "one sentence: why this drill, for this writer, now"
}
```
