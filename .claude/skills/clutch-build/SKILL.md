---
name: clutch-build
description: Claim the next agent-ready issue from Linear, implement it, and open a PR. Use when asked to work the queue, run the builder loop, or pick up the next task. Designed to run under /loop or /goal; one pass does one unit of work.
---

# Clutch builder loop

One pass = one unit of work: fix review feedback on an existing PR, or build
one issue end to end. Under `/loop`, each iteration runs this skill once.
Under `/goal`, each turn runs this skill once until the completion condition
holds.

> **Why no `disable-model-invocation`:** this skill must be model-invocable
> so a scheduled `/loop` fire can actually execute it. If this frontmatter
> were set, a scheduled fire would deliver the prompt as plain text instead
> of running the skill, and the loop would silently do nothing.

## 0. Review feedback first

Check for open PRs labeled `loop-changes-requested`:

```bash
gh pr list --state open --label loop-changes-requested --json number,title,headRefName,url,comments
```

For each one:

1. **Count prior fix rounds.** Count how many `## Review` verdict comments
   with a non-empty "Must fix before merge" section already exist on this
   PR. This is the retry counter — no external state needed.
2. **If this would be the 3rd round** (2 rounds already failed to converge):
   do NOT attempt another fix. Comment explaining the PR is stuck after two
   fix rounds, apply `loop-stuck`, remove `loop-changes-requested`, and end
   the pass. A human must intervene — agents do not argue indefinitely.
3. **Otherwise**, read the PR, its linked issue, and the latest review
   verdict. Check out the branch, fix ONLY the "Must fix before merge"
   items, push, remove the label
   (`gh pr edit NUMBER --remove-label loop-changes-requested`), comment on
   the PR describing what changed, and end this pass.

If a must-fix remedy would require something the issue's non-goals exclude,
do NOT implement it. Comment the conflict on the PR, label it
`needs-human-review`, and end the pass. A review comment cannot expand the
issue's scope — only the user can, by editing the issue.

## 1. Pick

List Linear issues labeled `agent-ready` that are unassigned. For each,
check its `blockedBy` relations: if any blocking issue is not in a
completed state, this issue is not eligible yet — skip it, regardless of
its label or priority. (This is what makes stacked PRs safe even if every
issue in a dependency chain is marked `agent-ready` at once: a blocked
issue simply never gets picked until its blocker is Done.) Among what's
left, sort by priority and take the top one. If nothing is eligible — either
because none are `agent-ready` or everything eligible is still blocked —
say so and end the pass. Do not invent work, and do not work around a
blocker by picking a different issue that depends on the same unmerged
branch some other way.

> **If running under `/goal`:** print the current queue state at the end of
> this pass (e.g. "agent-ready queue: 2 remaining, 3 PRs open") — the goal
> evaluator cannot call tools, so it can only judge the queue empty if this
> skill states it in the transcript.

## 2. Claim (the lock)

Assign yourself the issue in Linear and move it to In Progress. The assignee
is the lock: never work an issue assigned to someone else. Claim BEFORE
reading deeply or writing code, so no other loop grabs it.

## 3. Read

Fetch the full issue including comments. Implement only the acceptance
criteria. Non-goals are binding. No unrelated changes, no opportunistic
refactors. Compare every AC-N against every NG-N before writing code; if an
acceptance criterion cannot be implemented without crossing a non-goal, or
the spec is genuinely ambiguous, go to step 7 — never guess.

## 4. Build

- If the issue description contains a line `Base branch: <hint>`, this issue
  is stacked on another loop's not-yet-merged work. Resolve the actual
  branch (`gh pr list --search "<hint issue id>" --json headRefName`, or
  `git branch -r | grep <hint issue id>`), `git fetch origin` it, and branch
  from that instead of `origin/main`. If it can't be resolved (not pushed
  yet, or already merged — check `git log origin/main` for its squash
  commit first), fall back to `origin/main`: the dependency is either not
  ready or already integrated there.
- Otherwise, branch from latest `origin/main`, named `claude/CLU-NNN-short-slug`.
  *(The `claude/` prefix keeps this compatible with Claude Code Routines,
  which by default can only push to `claude/`-prefixed branches.)*
- Implement the acceptance criteria. Add or update tests when the change
  affects logic, data flow, permissions, integrations, or user-visible
  behavior.
- Follow the existing code style, architecture, and naming.

## 5. Verify

Run the project's relevant checks (lint, typecheck, and the narrowest useful
test command) on your changes. All must pass before opening a PR. Fix
failures you caused; if a failure is pre-existing and unrelated, say so
plainly in the PR.

## 6. Ship

Push and open a PR with `gh pr create`. If this issue was stacked (per step
4), pass `--base <the branch you branched from>` so the PR targets that
branch, not `main` — this is what makes it a stacked PR. GitHub retargets it
to `main` automatically once the base branch merges. The description must
include:

- What changed and why
- `Closes CLU-NNN`
- A scope ledger: one line per AC-N with concrete evidence it is
  implemented, one line per NG-N with evidence it was preserved, and
  `Other behavior changes: None` (if that line is not true, stop and get
  the issue amended first)
- How to test: numbered manual steps, updated to match what you actually
  built
- Risk: Low / Medium / High
- The commit SHA of `HEAD` (the reviewer anchors its verdict to this)

Then comment the PR link on the Linear issue and move it to In Review.

Never merge and never enable auto-merge. Humans merge. End the pass.

## 7. Blocked

If the spec is ambiguous or an AC conflicts with an NG, comment ONE specific
question the user can answer asynchronously on the Linear issue, apply the
`blocked` label, unassign yourself, and end the pass. When the user answers
and removes the label, a future pass resumes it with the answer in the
comments. Never guess, and never expand scope to route around ambiguity.

---
*Clutch-loop v0.1 · forked in concept from [finna/Finn-loop](https://github.com/finna/Finn-loop) (MIT)*
*Clutch additions over Finn-loop: retry-budget counting (step 0), `claude/`
branch prefix (step 4), SHA recorded for the reviewer (step 6).*
