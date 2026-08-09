---
name: clutch-review
description: Review open pull requests against their linked Linear issue, required GitHub CI checks, and merge conflicts, then post a three-group verdict with labels. Use when asked to review the PR queue or run the reviewer loop. Designed to run under /loop; never merges.
---

# Clutch reviewer loop

One pass = one PR reviewed. Under `/loop`, each iteration runs this skill
once. **Run with fresh context every time** — never carry over reasoning
from a builder pass or a previous review. Independence from the builder is
the entire point of this gate.

> **Why no `disable-model-invocation`:** must be model-invocable for
> scheduled `/loop` fires — or a GitHub-triggered Routine — to actually
> execute it rather than deliver it as inert text.

## 1. Find a PR needing review

```bash
gh pr list --state open --json number,title,labels,isDraft,url,headRefOid,mergeable,mergeStateStatus
```

Skip drafts. Skip PRs already labeled `loop-approved` or
`loop-changes-requested` **unless either**:
- the head commit SHA has changed since the last verdict (compare
  `headRefOid` against the SHA recorded in the most recent `## Review`
  comment — not comment timestamps, which are fragile), **or**
- `mergeable == "CONFLICTING"` right now, even with the same SHA as last
  time. A prior `loop-approved` verdict only proves gate 3 passed *at that
  moment* — if some other PR merged into this one's base branch since then,
  this PR can go from clean to conflicting with zero new commits of its
  own, and the stale label would otherwise never get corrected. Re-run gate
  3 (and only gate 3 — gates 1 and 2 are still valid against the
  unchanged SHA) and update the label if it now fails.

If nothing needs review, say so and end the pass.

## 2. Review it — three gates, in order

### Gate 1 — Does the code match the Linear contract?

- Parse the linked issue from the PR body (`Closes CLU-NNN`) and fetch it
  from Linear, including comments. No linked issue is itself a must-fix
  finding.
- Review against the linked issue ONLY. Look for: acceptance criteria gaps,
  bugs, broken data flow, unnecessary scope expansion, security issues, bad
  abstractions, missing loading/error states, and code future agents will
  find hard to modify. Do not suggest unrelated improvements unless severe.
- Read the full diff (`gh pr diff NUMBER`) and the changed files in context.
- If this gate fails → skip gates 2–3, verdict is `loop-changes-requested`.

### Gate 2 — Did required GitHub CI checks pass? *(Clutch addition)*

```bash
gh pr checks NUMBER
```

- Any required check failing or still pending at review time → this gate
  fails. Prefix the finding `[CI]`.
- If gate 1 passed but gate 2 fails → verdict is `needs-human-review`, not
  `loop-changes-requested`. A red pipeline is not something the builder can
  fix by re-reading the issue; it needs a human's attention to the CI run.

### Gate 3 — Are there merge conflicts at the reviewed SHA? *(Clutch addition)*

```bash
gh pr view NUMBER --json mergeable,mergeStateStatus
```

- `mergeable == "CONFLICTING"` or an unclean `mergeStateStatus` → this gate
  fails. Prefix the finding `[CONFLICT]`.
- If gates 1–2 passed but gate 3 fails → verdict is `needs-human-review`.

### Finding taxonomy

Every must-fix finding starts with one of:

- `[AC-N]` — the PR does not satisfy that acceptance criterion
- `[DEFECT]` — the implementation is broken while staying inside scope
- `[SECURITY]` — a severe security issue blocks shipping
- `[CI]` — a required GitHub check is failing or pending
- `[CONFLICT]` — a merge conflict exists at the reviewed SHA

Non-goals are binding. If fixing a finding would require something an NG-N
excludes, do not prescribe code: write `[SCOPE-CONFLICT AC-N ↔ NG-N]` with
the exact contradiction, add the `needs-human-review` label, and leave the
decision to the user. A reviewer finding never expands the issue.

## 3. Post the verdict

Post ONE comment (`gh pr comment NUMBER --body-file ...`) in exactly this
structure. **Record the reviewed SHA** — it is how the next pass decides
whether re-review is needed.

```md
## Review

Reviewed at: <headRefOid short SHA>

Summary: one or two plain-language sentences on what this PR does for the
user or business.

## 1. Must fix before merge

None.

## 2. Should fix soon

None.

## 3. Safe to merge

Yes.
```

Then set labels based on which gate(s) failed:

- All three gates pass: `gh pr edit NUMBER --add-label loop-approved --remove-label loop-changes-requested`
- Gate 1 fails: `gh pr edit NUMBER --add-label loop-changes-requested --remove-label loop-approved`
- Gate 2 or 3 fails (gate 1 passed): `gh pr edit NUMBER --add-label needs-human-review --remove-label loop-approved`

(`--remove-label` errors if the label is absent — drop the flag in that
case.) Use comments plus labels, not formal GitHub reviews: the loop often
runs on the PR author's own token, and GitHub rejects self-reviews.

> **`loop-approved` is not a GitHub approval.** It cannot be wired into
> branch protection rules. It is structured evidence — all three gates
> passed — presented for the human's own merge decision.

## 4. Hard limits

- Never merge. Never push commits to the PR branch.
- Never approve or request changes via a formal GitHub review.
- A `loop-approved` label means "no must-fix findings across all three
  gates" — the human still makes the merge call.

---
*Clutch-loop v0.1 · forked in concept from [finna/Finn-loop](https://github.com/finna/Finn-loop) (MIT)*
*Clutch additions over Finn-loop: gates 2–3 (CI + merge conflicts), SHA-anchored
re-review, `[CI]`/`[CONFLICT]` finding prefixes, `needs-human-review` routing
for infra-level failures vs. `loop-changes-requested` for contract failures.*
