# Writing Coach

A local-first app that uses AI to make you a stronger writer without writing for you. It reads, asks questions, assigns exercises and responds. Every sentence on the page is yours. See [the vision document](Writing%20Coach%20—%20Vision%20Document.md).

## Run it

Requires Node 20 or newer. There are no dependencies to install.

```bash
npm start
```

Open http://localhost:4317, go to **Settings** and paste your OpenRouter key. Drills work without a key; feedback needs one.

To try every flow without a key or any cost, use mock mode. It writes to a separate `data-mock/` folder:

```bash
npm run mock
```

Tests: `npm test`.

## What's here

| Mode | What it does |
|---|---|
| **Today** | The daily drill (10–20 min), picked from the tagged library to fit your focus skill. Non-fiction leads until the habit holds. "Tailor to me" has a cheap model adapt the drill to you. Also shows writing days (no streak to break), weekly rewrite count, and your most recent "what I liked" line. |
| **Draft review** | Paste or write a piece and say what it's for. You choose the kind of feedback (structure, voice, line level, argument, "does it work?", sparring partner), the depth (1–4 layers), the tone (gentle → editor's red pen), and "encouragement only" for bad days. |
| **Imitation studio** | Public-domain model passages, with copywork plus annotation, the Franklin rebuild (outline → set aside → rebuild → compare, with the original hidden at step 2), or pastiche. The coach then compares your version with the original move by move. |
| **Constraint lab** | Constraint prompts with live checks: exactly 50 words, all dialogue, no letter E, every sentence a question… |
| **Projects** | For long work. You write the plan; the editor reads it and asks questions. Your answers feed the next round. |
| **Reflection log** | One or two lines after each session. Liked sentences collect in an evidence file. |
| **Writer profile** | Everything the coach believes about you, editable as a form or as raw JSON. |

### How feedback works

Every critique has four layers, in this order: **reader response**, then **what's working** (quoted), then **the highest-leverage change** (two at most, in craft terms), then **a way in** (a question or technique, never a fix). The server enforces the two-issue cap and the depth you choose, whatever the model sends back.

### The no-ghostwriting rule, in code

[`server/guard.js`](server/guard.js) checks every coach response before you see it:

- **Evidence check.** Every quote given as evidence must be in your text. A quote that isn't is flagged as "not in your text".
- **Replacement prose.** Wording the coach writes for you is withheld: any quoted span over 12 words that isn't yours (or from the model passage), and any unquoted sentence that closely paraphrases one of yours. You can reveal it, but that counts as a rewrite.
- **Rewrites** are a separate action that requires a reason. They, line edits and revealed suggestions all go to `rewrites.jsonl`, and the weekly count appears on Today.

### Memory and growth

- Every save is a version. The Versions tab shows a word-level diff between any two versions. Each piece of feedback links to "see changes since".
- The coach changes your profile only through reflection. When you click **Finish & reflect**, it proposes changes: patterns, strengths, issues resolved, a new focus, a phase change. You confirm, keep as a hypothesis, or reject each one, and you can edit the wording first. Hypotheses are shown to the coach as unconfirmed.
- The issue history and recent feedback go into each critique, so the coach can say "three weeks ago this was the issue; it isn't now." **Blind re-review** re-reads a piece without that history, as a check on flattery.

## Where things live

Everything is a plain file you can read without the app:

```
data/                       (git-ignored; back it up or version it separately)
  profile.json              the writer model
  settings.json             models, tone, privacy (no secrets)
  pieces/<id>/piece.md      current text
  pieces/<id>/versions/     v001.md, v002.md, …
  pieces/<id>/feedback/     each response as .md (readable) and .json
  pieces/<id>/meta.json     title, kind, purpose, plan, version list
  reflections.md            the reflection log
  rewrites.jsonl            every rewrite you asked for
  usage.jsonl               every model call, with cost
~/.writing-coach/secrets.json   your OpenRouter key, outside anything you'd share
```

To keep your writing somewhere else (a synced folder, say), set `WRITING_COACH_DATA`.

## Tuning it

- **Prompts** are files in [`prompts/`](prompts/): guardrails, the feedback shape, drills, imitation, editor's questions, profile proposals and rewrites. They're re-read on every call, so edits take effect without a restart.
- **Coach config** ([`coaches/andrew.md`](coaches/andrew.md)) is how the coach talks: register, references, bluntness. It's kept separate from the writer profile. A second writer would get a new coach file plus a new profile, chosen in Settings.
- **Library**: [`library/exercises.json`](library/exercises.json) holds the drills, tagged by skill, genre and level (a couple of `ages 8-10` ones are already there). [`library/constraints.json`](library/constraints.json) holds the constraint prompts, and [`library/models/`](library/models/) the model passages, one Markdown file each. Check the passages against a source edition.
- **Models by task**: drills default to `anthropic/claude-haiku-5.5`; critique and companion work default to `anthropic/claude-sonnet-5.5`. Change them in Settings, where "Load the model list" shows OpenRouter prices.
- **Privacy**: on by default. Requests ask OpenRouter for providers that don't retain or train on prompts (`provider.data_collection: "deny"`).
- **Cost**: the sidebar shows spending for this browser session and for the month. Settings lists each call.

## Not built yet (v1.0 in the roadmap)

Onboarding interview, Beatrix's version (play-first framing, one-question feedback, dictation, parent view), and scheduled morning drills. The separations they need are already in place: coach config vs. profile, a tagged library, and a per-writer profile file.
