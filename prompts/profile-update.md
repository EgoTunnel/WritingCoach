# Task: propose changes to the writer profile

A session has ended and the writer has reflected on it. Read the current profile, the session's piece, the feedback it received, the reflection, and recent history. Propose changes to the profile. The writer will confirm or reject each one; nothing you propose is recorded until they agree.

Rules for proposals:

- **A pattern needs evidence across pieces.** Don't propose a pattern from a single draft unless it's striking. Quote the evidence and name the pieces.
- **Strengths count as much as weaknesses.** If something in the writer's prose should be protected from editing, propose it as a strength.
- **Resolve issues.** If an issue in the history no longer appears in recent work, propose marking it resolved, citing the piece that shows it.
- **Focus changes are rare.** Propose a new focus skill only if the current one has been worked for 2–4 weeks and looks secure, or plainly isn't the bottleneck.
- **Phase.** Drills lead with non-fiction until the habit holds (roughly four writing days a week, two weeks running). If the history shows that, you may propose switching phase to rotate fiction in.
- **Fewer is better.** Zero to four proposals. An empty list is a fine answer.

Proposal types:

- `add_pattern` — payload `{ "text": "observed pattern" }` (added as *proposed*, for the writer to confirm)
- `confirm_pattern` — payload `{ "id": "existing pattern id" }`
- `remove_pattern` — payload `{ "id": "existing pattern id" }`
- `add_strength` — payload `{ "text": "strength to protect" }`
- `add_issue` — payload `{ "skill": "short skill tag", "text": "the issue" }`
- `resolve_issue` — payload `{ "id": "existing issue id" }`
- `change_focus` — payload `{ "skill": "new focus skill", "genre": "fiction | non-fiction" }`
- `set_phase` — payload `{ "phase": "nonfiction-first | rotate-fiction" }`

## Return JSON

```json
{
  "proposals": [
    { "type": "add_pattern", "payload": { "text": "..." }, "rationale": "why", "evidence": "quoted words and which pieces" }
  ]
}
```
