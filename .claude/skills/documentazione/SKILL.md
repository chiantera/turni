---
name: documentazione
description: "Use after finishing a piece of work on Turni — a bug fixed, a feature landed, a migration applied, a defect found in production, an environment trap that cost time, a false claim removed from the public page, files added or deleted. Decides what is worth recording, where it belongs (AGENTS.md, HANDOFF.md, README.md, or a smoke-test assertion), and writes it. Also use when asked to update the docs, or before handing work off."
---

# documentazione

Keep the project's memory honest and small.

Docs rot in two directions. They go stale, and they bloat with advice nobody
needed. This skill exists to fight both: record what would change someone's
behaviour, and nothing else.

## When this fires

Run it at the end of a unit of work, before the final commit. Concretely, when
any of these just happened:

| What happened | Where it goes |
|---|---|
| A defect existed in production that typecheck/lint/tests didn't catch | `AGENTS.md` → Verified Traps, **and** a smoke-test assertion |
| A tooling or environment quirk cost more than a few minutes | `AGENTS.md` → Verified Traps |
| A feature landed, or a TODO closed | `HANDOFF.md` |
| Something needs a manual step before it works (migration, env var, asset) | `HANDOFF.md`, marked clearly |
| A file, directory or script was added or removed | `README.md` structure map |
| A claim on the public page turned out false | fix the copy, add a smoke-test assertion |
| A schema change was applied to a live database | `HANDOFF.md`, with what was verified afterwards |

## When this does NOT fire

Do not write anything for:

- **What git already records.** "Renamed X to Y", "added function Z". The log
  has it, better than prose will.
- **What the code says.** Structure, signatures, call graphs. If someone needs
  a doc to know what a function takes, fix the function's name.
- **Advice you have not paid for.** "Remember to handle errors", "consider
  performance". Generic counsel is the noise that makes people stop reading
  the specific warnings next to it.
- **Anything you cannot tie to something that actually happened.**

That last one is the whole discipline. If you cannot name the incident, the
entry does not go in.

## How to write an entry

**Name the incident, then the rule.** Not "be careful with exit codes" but
"`npm run build | tail` returned 0 on a failed build, because the pipeline
reports tail's status." The reader believes a story; they skim a maxim.

**Say what it cost.** "This is why `planning_runs` sat unapplied for days while
four pages were broken." Consequence is what makes someone read the next line.

**Show the wrong version next to the right one** when the difference is
syntactic. Two lines beat two paragraphs.

**Prefer deleting to adding.** Before appending, reread the surrounding
section: an entry that has been superseded should be removed, not left to
contradict the new one. A doc that only grows stops being read.

## Where things live

- **`AGENTS.md`** — durable rules for whoever works here next, human or agent.
  Traps, conventions, constraints. Written in English, matching the file.
  This is the file that changes behaviour; keep it earned.
- **`HANDOFF.md`** — the state of the work: what is done, what is not, what
  needs a manual step, what was verified and how. Written in Italian.
- **`README.md`** — public and architectural: the model, the structure map.
  Written in Italian. Update the map when files move.
- **`scripts/verifica-produzione.sh`** — for defects observable from outside.
  Every assertion carries the incident that justifies it.
- **`CLAUDE.md`** — includes `@AGENTS.md`, plus the environment links. Never
  put a **rule** here: it would exist in two places and become two different
  rules. Stable facts that other providers also need — URLs, project ids — may
  be repeated, because those tools read `AGENTS.md` and never see this file.

## The smoke test needs pruning too

Adding an assertion is cheap, which is the danger. Six exist today and each one
maps to a real failure. When they reach twenty, reread them: an assertion that
would never fail again is a check that trains people to ignore the output.

Watch for collisions as copy evolves — a string forbidden because it appeared
in a fabricated testimonial should not start rejecting legitimate copy that
happens to contain it.

## Finish

1. Make the edits.
2. Run `npm test` and `npm run typecheck` if you touched anything but prose.
3. Update the `Last updated` line at the foot of `AGENTS.md` when you changed it.
4. Commit with the docs, not separately: a rule committed apart from the change
   that motivated it loses the only context that explains it.
