# Writing Coach — Vision Document

Nov 1, 2026 · @Andrew

## Purpose

The Writing Coach (working name) is a personal app that uses AI to make me a stronger, more confident writer, not to write for me. It runs on my own OpenRouter key and is built for me first, with a design that can later extend to Beatrix and other writers.

**The problem.** I've lost faith in my ability to write and now hand almost all of my writing to AI. My comps papers were the last substantial writing I did for myself. The skill is still there; what's gone is the practice, the nerve, and the habit of finishing.

**The paradox the app must resolve.** The tool that let my writing atrophy is the same tool I want to use to rebuild it. So the coach's defining trait is restraint: it reads, questions, assigns, and responds, but the sentences on the page are always mine.

**What it covers.**

- **Fiction:** scene, character, dialogue, point of view, voice, structure.
- **Non-fiction:** argument, essay, explanation, professional and public writing (posts, course material, AI Info Hub pieces).
- **The writer behind both:** confidence, habit, and a voice I recognize as my own.

## Guiding principles

Eight rules govern every interaction; when a feature conflicts with one, the rule wins.

1. **The writer holds the pen.** The coach never drafts or rewrites my prose by default. It may quote my sentence back, ask a question about it, name a technique, or point to a model, but the fix is mine. A rewrite is available only on explicit request, and it is logged as such.
2. **Practice over product.** Like a music teacher, the coach assigns short, deliberate exercises aimed at one skill, not only verdicts on finished pieces. Ten minutes of targeted work beats an hour of general critique.
3. **Imitation is the oldest method.** Copywork, Franklin's *Spectator* method (outline a model, set it aside, rebuild it, compare), and pastiche are first-class activities, using public-domain models where possible.
4. **Read before you judge.** Feedback opens with the reader's experience ("I lost track of who was speaking at the second paragraph"), not a grade.
5. **One lever at a time.** Each response names the one or two changes with the most leverage. A draft covered in twenty notes teaches nothing.
6. **Praise must be specific and earned.** "This verb carries the whole sentence" is useful; "great job" is noise. The coach never flatters, because flattery would confirm that the feedback can't be trusted.
7. **Craft vocabulary, used precisely.** Free indirect discourse, periodic sentences, the turn in an essay, scene versus summary. Naming a move makes it repeatable.
8. **The writer can see and edit everything the coach believes about them.** No hidden profile, no opaque scoring.

## Who it's for

Version 1 has one user: me. Every design decision is made for a highly trained reader who has stopped writing, not for a beginner. Later users are planned for in the architecture but not built for yet.

| Stage | Writer | What they need | What changes in the coach |
| --- | --- | --- | --- |
| v1 | Andrew | Rebuild habit and confidence; reclaim a personal voice in fiction and non-fiction; stop defaulting to delegation | Peer-level craft talk, literary and theoretical references, blunt but calibrated critique |
| v2 | Beatrix (8, Grade 4) | Play, story-making, and early sentence craft; encouragement to finish things | Playful framing, simpler vocabulary, gentler feedback, a parent view, tighter content limits |
| v3 | Other writers (students, colleagues, clients) | Their own goals and level | Onboarding interview, profile templates, possibly hosted or self-hosted versions |

The test for v1: would I open it on an ordinary Tuesday evening, without guilt or dread, and write something?

## Core experiences

The app offers six modes, each a different relationship to the page. The daily drill is the heart of it; the others feed it.

**1. Daily drill (10–20 minutes).** One exercise aimed at the skill I'm currently working on, chosen from my profile. In v1, drills lead with non-fiction (argument, essay, explanation); fiction drills rotate in once the habit holds.

- *Example:* "Write a 150-word paragraph in which a character enters a room and we learn something about them only through what they notice. No adjectives describing the character."
- *Example:* "Take the claim 'AI tutoring flattens pedagogy.' Write one paragraph that argues it, then one that concedes the strongest objection without collapsing."

**2. Draft review.** I paste or write a piece, say what it's for and what kind of feedback I want (structure, voice, line level, "just tell me if it works"). The coach responds within those terms.

**3. Imitation studio.** The coach supplies a model passage (public domain: Emerson, Hawthorne, Dickinson's letters, Johnson's essays) and runs one of three exercises: copywork with annotation, the Franklin rebuild, or pastiche on a new subject. Afterward it compares my version with the original move by move.

**4. Constraint lab.** Generative prompts for creativity: write in second person, write a scene entirely in dialogue, an essay with no abstract nouns in the first paragraph, a story in exactly 50 words. Constraints remove the blank page.

**5. Project companion.** For longer work (a story, an essay, a course chapter), the coach holds the plan, tracks revisions, and asks the questions an editor would: "What does the reader need to know by the end of section 2?" It never generates the outline for me; it interrogates mine.

**6. Reflection log.** After each session, one or two lines: what was hard, what I liked in my own sentences. Over time this becomes evidence against the belief that I can't write.

## The writer model

Personalization comes from one file the coach reads at the start of every session and proposes changes to at the end. I confirm or reject each change, so the coach's picture of me is never something I haven't seen.

&#91;embedded content: coaching loop · 5 steps around the writer profile\]

The profile steers both what I'm assigned and how drafts are read; reflection is the only way it changes.

**What the profile holds.**

- **Goals,** in my words: "Finish a short story I'd send to a journal." "Write my own LinkedIn posts again."
- **Current focus skill:** one at a time, for two to four weeks (for example, "scene versus summary" or "leading with the claim").
- **Influences and target voices:** writers whose moves I want to learn from.
- **Observed patterns,** each tagged as confirmed or proposed: "Hedges claims with 'perhaps' and 'arguably'" (proposed after three drafts; I confirm or reject).
- **Strengths to protect:** things the coach should not edit out of me.
- **History:** pieces written, revisions made, issues resolved and when.

**Rule for inferences.** The coach may notice a pattern; it may not record one as fact until I agree. The same rule protects later users, especially children.

## How feedback is given

Every critique follows the same four-layer shape, and the writer chooses how deep to go. The order matters: the reader's experience comes before diagnosis, and diagnosis before technique.

1. **Reader response.** What happened to an attentive reader: where attention sharpened, where it drifted, what they expected next.
2. **What's working.** One or two specific strengths, quoted. This is information about what to keep doing, not consolation.
3. **The highest-leverage change.** One issue (two at most), named in craft terms, located in the text, with the reason it matters for *this* piece's purpose.
4. **A way in, not a fix.** A question, a technique to try, or a short model from another writer. Line edits appear only if I ask for them.

**Example.** For an essay paragraph that buries its claim:

> *Reader response:* I read three sentences of context before I knew what you were arguing, so I couldn't weigh them. *Working:* "The syllabus is a promise the course cannot keep" is the best sentence here: concrete and slightly dangerous. *Change:* That sentence is your claim, and it's fourth. Try a periodic structure in reverse: claim first, then the evidence that complicates it. *Way in:* Rewrite the paragraph so the first sentence could stand alone as a tweet. Then see which of the three context sentences you still need.

**Tone controls.** A slider from "gentle" to "editor's red pen," set per session. On a bad day I can ask for encouragement only; the coach honours it but notes that the piece hasn't been critiqued.

**Guardrails against the two failure modes.** Against flattery: the coach must quote evidence for every strength and every weakness. Against discouragement: it never delivers more than two problems at once, and it tracks improvements so it can say "three weeks ago this was the issue; it isn't now."

## Technical shape

A local-first web app, in the same spirit as Pulse and Narthex: my writing lives on my machine, and only the text needed for a given request goes to the model through OpenRouter.

- **Storage.** Plain files I can read without the app: each piece is a Markdown file with its revision history; the writer profile is a Markdown or JSON file; feedback is stored alongside the draft it responds to. Nothing is lost if the app is abandoned.
- **Revision tracking.** Every save is a version. The app can show a diff between drafts, so both I and the coach can see what changed after feedback.
- **Models by task.** OpenRouter lets each job use a different model: a cheap, fast one for generating drills and prompts; a strong one for critique of finished drafts. Model choice is a setting, not hard-coded.
- **Prompts as editable files.** The coach's instructions (persona, feedback shape, guardrails) are text files in the project, so I can tune them as a learning designer would tune a rubric.
- **The no-ghostwriting rule in code.** The critique prompt forbids rewriting more than a phrase; responses are checked for long passages that look like replacement prose. Requested rewrites are a separate, logged action.
- **Key and cost.** The API key is stored locally, never in the files I might share. A running cost display per session keeps spending visible.
- **Privacy.** Use OpenRouter's settings to prefer providers that don't retain or train on prompts, especially once Beatrix uses it.
- **Build path.** A VISION.md (this document, condensed) handed to Claude Code, as with Narthex.

## Designing for other writers later

The app stays single-user in v1, but three separations made now keep it adaptable without a rewrite.

- **Coach config is separate from writer profile.** "How the coach talks" (register, references, bluntness) lives in one file; "who the writer is" lives in another. A Beatrix coach is a new config plus a new profile, not a fork of the code.
- **The exercise library is tagged, not personal.** Each drill carries tags for skill, genre, and level (for example `dialogue`, `fiction`, `ages 8–10`). My profile picks from the library; so would hers.
- **Onboarding is an interview, not a form.** For a new writer the coach asks about goals, reading, and a writing sample, then proposes a starting profile for the writer to correct.

**What changes for Beatrix specifically.**

- Play-first framing: quests, a story world she builds over time, celebration of finished pieces.
- Feedback capped at one suggestion, phrased as a question ("What does the dragon sound like when it's scared?").
- Voice input or dictation, so ideas aren't limited by typing speed.
- A parent view showing what she wrote and what the coach said; no hidden conversations.
- Stricter content limits on prompts and responses, set in the coach config.

## Scope, risks and success

**Not in scope.** A ghostwriter, a grammar checker, a publishing platform, a social feed, or a grading tool. Anything that produces prose on my behalf belongs in other tools.

**Risks.**

| Risk | What it looks like | Mitigation |
| --- | --- | --- |
| Delegation creeps back | I start asking the coach to "just show me how you'd write it" | Rewrites are a separate, logged action; a weekly count of them appears on the dashboard |
| Sycophancy | Every draft is "strong" | Evidence rule: every judgment quotes the text; periodic blind re-review of old drafts |
| Over-critique | Feedback confirms the fear that I can't write | Two-issue cap; progress notes that cite earlier drafts |
| Novelty fade | Used for two weeks, then abandoned | Drills short enough for a bad day; streaks without penalties |
| Cost | Strong models on every keystroke | Cheap models for drills, strong ones only for full critiques |

**How I'll know it's working (after 3 months).**

- I write by hand (with the coach, not by it) at least four days a week.
- I've finished and revised at least one piece of fiction and one essay I'd show someone.
- Rewrite requests trend toward zero.
- Re-reading early pieces, I can see specific improvements the coach can also name.
- I write something for work myself that I would previously have delegated.

**Roadmap.**

1. **v0.1 — Drill and review.** Profile file, daily drill, draft review with the four-layer feedback, local storage.
2. **v0.2 — Memory and growth.** Revision diffs, reflection log, profile updates proposed by the coach and confirmed by me.
3. **v0.3 — Imitation studio and constraint lab.**
4. **v0.4 — Project companion** for long-form work.
5. **v1.0 — Second writer.** Coach config separation, onboarding interview, Beatrix's version with a parent view.

**Open questions.**

- What's the app called?
- Should drills arrive on a schedule (a morning prompt) or only when I open the app?
- Do I want a "sparring partner" mode where the coach argues back against my essay's claim?
- Which public-domain models best match the voice I want to recover?
