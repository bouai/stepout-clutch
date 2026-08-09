# StepOut Roadmap

Living progress-context doc. Update this whenever a phase completes or scope changes — this is the file a fresh session should read first to know where things stand.

## Status legend
`[x]` done · `[~]` in progress · `[ ]` not started

## Completed — Loops 1–7 (merged to `main`)

| Issue | What |
|---|---|
| CLU-5 | Scaffold: Expo + FastAPI, core data models, tab navigation shell |
| CLU-6 | Weather-aware checklist (Open-Meteo, one-time location, condition flagging) |
| CLU-7 | Transit map: current location, saved destinations, straight-line distance |
| CLU-8 | Checklist interactions: PATCH toggle/edit, new-item form |
| CLU-9 | Inventory tab: list, add, pack toggle |
| CLU-10 | Create/delete saved destinations from Transit |
| CLU-11 | Active Tracking: geofence trigger management + enter/exit local notifications |

All backed by pytest (52 passing as of 2026-08-09) and `tsc --noEmit` clean.

## Phase 0–1 — Stabilization `[x]` done (2026-08-09)

First real on-device test (2026-08-09, EAS dev-client build on Android) surfaced gaps beyond what pytest/tsc could catch. Audited every router + every prior loop's non-goals; found:

| Issue | Gap | Status |
|---|---|---|
| CLU-12 (Loop 8) | ChecklistItem↔InventoryItem link | `[x]` done — merged #8 |
| CLU-13 (Loop 9) | Google Maps Android API key | `[x]` done — merged directly (10fb580) |
| CLU-14 (Loop 10) | DELETE on ChecklistItem / InventoryItem | `[x]` done — merged #9 |
| CLU-15 (Loop 11) | PATCH/DELETE on GeofenceTrigger | `[x]` done — merged #10 |

Verified on `main` post-merge: 64 pytest passing (up from 52), `tsc --noEmit` clean.

**Note on the Maps key:** used Google's free "Demo Key" (`mapsplatform.google.com/maps-demo-key`) — no billing account, no credit card, works for Maps SDK for Android specifically. Dev/testing only (daily quota, not for production) — revisit with a real billing-backed key only when this app is heading toward real users. Key lives in `app/app.json` under `expo.android.config.googleMaps.apiKey`.

## Design direction

Local export: `Stepout_app_design_v1/` (repo root) — 5 mockup frames in `screenshots/`, plus `StepOut App.dc.html` / `StepOut Deck.dc.html`. Source tool link (private, not fetchable outside the user's own browser session): `https://claude.ai/design/p/12462dca-0a24-4d7f-8f38-cf96dcb45bde`.

Mockups show: 3-screen onboarding (Welcome/Location/Notifications), a new 5th "Home" tab (dashboard), and the 4 existing tabs relabeled **Plan / Go / Track / Pack** (= Planner / Transit / Active Tracking / Inventory). Visual system: coral→purple gradient background, bold rounded sans headings, white rounded-24 cards with soft shadow, pill-shaped floating bottom nav, coral pill CTAs.

Home introduces two concepts that don't exist in the data model yet: a **Trip** (multi-trip selector — "Tokyo / Lisbon / +") and a persisted **alert/event log** ("Entered Shinjuku Ward · 5:41 AM"). Both are new backend entities, not styling.

## Phase 2–6 — Redesign `[~]` in progress

All issues filed 2026-08-09, all labeled `agent-ready` the same day and run through `/loop /clutch-build` + `/loop /clutch-review`.

| Issue | Loop | Phase | Stacking | Status |
|---|---|---|---|---|
| CLU-16 | 12 | Reskin | independent, off `main` | `[x]` done — merged #11 |
| CLU-17 | 13 | Trip data model | independent, off `main` | `[~]` PR #12 open, `loop-approved`, conflict resolved (see incident below) — awaiting merge |
| CLU-18 | 14 | Alert/event log | **stacked on CLU-17's branch** | `[ ]` blocked on CLU-17 merging |
| CLU-19 | 15 | Home dashboard | **stacked on CLU-18's branch** (→ CLU-17 transitively) | `[ ]` blocked on CLU-18 merging |
| CLU-20 | 16 | Onboarding | independent, off `main` | `[~]` PR #13 open — awaiting review/merge |

### Incident: CLU-16/CLU-17 merge conflict (2026-08-09)

CLU-16 and CLU-17 were both marked "independent" and built in parallel off the same `main`. Both touch all 4 screen files (`PlannerScreen.tsx`, `InventoryScreen.tsx`, `TransitScreen.tsx`, `ActiveTrackingScreen.tsx`) — CLU-16 for styling, CLU-17 for trip-scoped data fetching. The stacking analysis when Phase 2–6 was planned only cross-checked file overlap within the CLU-17→18→19 *backend* chain (`models.py`/`schemas.py`); it never checked CLU-16 against CLU-17, even though both issues' own "Relevant files" lists named the same 4 screens. When CLU-16 merged first (#11), CLU-17's PR (#12) went from clean to `CONFLICTING` with zero new commits of its own — and `clutch-review` had already labeled it `loop-approved` before the conflict existed, with no mechanism to notice the verdict went stale.

Fixed by hand: merged `origin/main` into `claude/CLU-17-trip-data-model`, manually reconciled all 4 screens (CLU-16's `LinearGradient`/card/theme structure + CLU-17's `TripSwitcher`/`useTripContext`/`?tripId=` logic, nothing dropped from either side), ran `npx tsc --noEmit` (clean) and `pytest` (72/72), pushed. PR #12 is `MERGEABLE`/`CLEAN` again.

Two process fixes applied same day:
1. **`clutch-build`** (unchanged this time — the gap was in planning, not execution).
2. **`clutch-review`** ([SKILL.md](.claude/skills/clutch-review/SKILL.md) step 1): now re-checks `mergeable` even when a PR's head SHA is unchanged, since a `loop-approved` verdict can go stale purely from *another* PR merging into the same base — not just from new commits on the PR itself.

**Lesson for planning future phases:** before declaring two issues "independent," diff their `Relevant files` lists against each other, not just against the phase each is conceptually tied to. Two issues can share zero *concepts* and still collide on every file that matters.

```
CLU-16 (reskin) ── independent, own branch off main

CLU-17 (trip model) ── independent, own branch off main
        │
        ▼  stacked (same files: models.py, schemas.py)
CLU-18 (event log)
        │
        ▼  stacked (needs both 17 + 18's endpoints)
CLU-19 (Home dashboard)

CLU-20 (onboarding) ── independent, own branch off main
```

**Why CLU-17→18→19 are stacked, not just sequential:** CLU-17 and CLU-18 both touch `server/app/models.py` and `server/app/schemas.py` — building both off `main` in parallel guarantees a merge conflict on whichever lands second. CLU-19 (Home) is a pure aggregator of both and literally cannot function without both. Stacking lets CLU-18's build start without waiting for CLU-17 to merge first, while still avoiding the file collision. Mechanics: each stacked issue's description has a `Base branch:` note; `clutch-build` (edited today, see `.claude/skills/clutch-build/SKILL.md` step 4/6) resolves the actual branch for that referenced issue and branches from it instead of `origin/main`, then opens its PR with `--base <that branch>` instead of `main`. When the bottom PR merges, GitHub retargets the next one's base to `main` automatically.

**Practical order to actually build in:** CLU-16 and CLU-17 can run in either order or even "simultaneously" (two separate loop passes, two separate branches, both off `main`) since they don't touch overlapping files. CLU-18 should not start until CLU-17's branch exists (even if unmerged) for the loop to stack on. CLU-19 should not start until CLU-18's branch exists. CLU-20 has no constraint.

**Phase 2 — Visual reskin (CLU-16).** Restyle Plan/Go/Track/Pack to the new visual system (shared theme constants: colors/radii/spacing/typography), rename tabs, zero behavior change. Open gap: mockups only show Home + Plan + onboarding — Transit/Active Tracking's own internals (map layout, trigger list, modals) have no reference mockup, will need extrapolation and a review pass before Phase 5 locks it in.

**Phase 3 — Trip data model (CLU-17).** New `trips` table; nullable `trip_id` FK added to `checklist_items`, `inventory_items`, `saved_destinations`, `geofence_triggers`, additive/backward-compatible (`?tripId=` opt-in filter, no forced backfill); frontend trip-switcher shared across all 4 screens.

**Phase 4 — Alert/event log (CLU-18, stacked on CLU-17).** New `geofence_events` table (trigger_id, fired_at, direction); Active Tracking POSTs an event each time it fires a local notification; `GET /geofence-events` (latest-first) powers Home's "Latest Alert" card.

**Phase 5 — Home dashboard (CLU-19, stacked on CLU-18).** New 5th tab. Weather card (current trip's location), checklist/packing progress rings (current trip's data), "Up Next" nearest destination (reuses existing `/saved-destinations/{id}/distance`), "Latest Alert" (Phase 4).

**Phase 6 — Onboarding (CLU-20).** 3-screen first-run flow, shown once, replacing the ad-hoc permission prompts currently scattered across Planner and Active Tracking. No dependencies.

## Known risks

- Phase 3 is where a scope surprise is most likely — re-confirm size once the actual diff is visible.
- `expo-notifications` is permanently broken on Expo Go/Android (Expo's own intentional design, SDK 53+) — testing must go through an EAS dev-client build from here on, not Expo Go.
- Each EAS dev-client rebuild takes ~10–15 min — batch device-testing checkpoints rather than rebuilding after every change.

## Environment notes (for a fresh session)

- Expo SDK 57 project. Play Store's Expo Go lags SDK support by design (review queue) — irrelevant now that a dev-client build exists, but relevant if the dev-client ever needs reinstalling from scratch.
- EAS project: `@abhisheksr29/stepout`, `eas.json` has a `development` profile (APK, internal distribution). Rebuild with `npx eas-cli build --profile development --platform android` from `app/`.
- Backend dev run (LAN-accessible for phone testing): `python -m uvicorn app.main:app --host 0.0.0.0 --port 8000` from `server/`.
- Frontend dev run: `EXPO_PUBLIC_API_URL=http://<LAN_IP>:8000 npx expo start` (or `npx expo start --dev-client` once the dev-client is installed on-device), from `app/`.
- This machine needed `git config --global --add safe.directory D:/Dev/stepout-clutch` and the same with `/.git` appended — EAS's upload step shells out to `git clone` and Windows ownership metadata trips Git's dubious-ownership check otherwise.
