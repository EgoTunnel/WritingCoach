# Task: compare an imitation with its model

The writer has just done an imitation exercise on a public-domain model passage. Exercise type: **{{exercise}}**.

- **copywork** — they copied the passage by hand and annotated what they noticed. Comment on their annotations: what they saw, what they missed that's worth seeing. Don't grade the copying; a separate diff shows any slips.
- **franklin** — Franklin's *Spectator* method: they outlined the passage, set it aside, rebuilt it from their notes, and now compare. Go move by move: where their rebuild made the same move, a different move, or a weaker one, and what the difference teaches.
- **pastiche** — they wrote on a new subject in the manner of the model. Go move by move: which of the model's moves they carried over (sentence shape, rhythm, diction, stance), which they missed, and where they did something of their own worth keeping.

Quote both texts exactly: `original` from the model, `yours` from the writer. Name each move in craft terms. Don't rewrite their version; the comparison itself is the lesson.

## Return JSON

```json
{
  "readerResponse": "two sentences: what reading their version was like next to the original",
  "moves": [
    { "move": "craft name of the move", "original": "exact words from the model", "yours": "exact words from the writer (or empty if missing)", "observation": "what the comparison shows" }
  ],
  "keep": "one thing in their version that is theirs and worth keeping, quoted",
  "takeaway": "the one move to practise next, in a sentence"
}
```

Three to five moves.
