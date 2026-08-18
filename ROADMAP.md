# StepOut Roadmap

Living progress-context doc. Update this whenever a phase completes or scope changes — this is the file a fresh session should read first to know where things stand.

_Updated: 2026-08-18 — Phase 11 (caching, drop-a-pin, unified readiness, swipe-to-delete, full glass reskin) code-complete on `claude/round-6-cache-and-pin` ([PR #20](https://github.com/bouai/stepout-clutch/pull/20))._

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

## Phase 2–6 — Redesign `[x]` done (all merged 2026-08-09)

All issues filed 2026-08-09, all labeled `agent-ready` the same day and run through `/loop /clutch-build` + `/loop /clutch-review`.

| Issue | Loop | Phase | Stacking | Status |
|---|---|---|---|---|
| CLU-16 | 12 | Reskin | independent, off `main` | `[x]` done — merged #11 |
| CLU-17 | 13 | Trip data model | independent, off `main` | `[x]` done — merged #12 (2026-08-09) |
| CLU-18 | 14 | Alert/event log | **stacked on CLU-17's branch** | `[x]` done — merged #14 (2026-08-09) |
| CLU-19 | 15 | Home dashboard | **stacked on CLU-18's branch** (→ CLU-17 transitively) | `[x]` done — merged #15 (2026-08-09) |
| CLU-20 | 16 | Onboarding | independent, off `main` | `[x]` done — merged #13 (2026-08-09) |

**Verified 2026-08-15:** all four PRs confirmed `MERGED` via `gh pr list`, 78 pytest passing (up from 72 at last incident checkpoint), `tsc --noEmit` clean from `app/`. This table had drifted behind the actual merge state for several days — none of CLU-17/18/19/20 were caught as done until this cross-check, despite having merged the same day they were opened.

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

## Phase 7 — MVP hardening `[x]` code complete (2026-08-16), device pass pending

Branch `claude/mvp-hardening-round-1`. Driven by an audit against a device checkpoint that had not happened since PR #7 (CLU-11).

**Round 1 — defects.** Four of five screens rendered lists into a fixed `View` with no scroll container, making every row past the first screenful permanently unreachable; `tsc` and `pytest` were green the whole time, because every gate sat below the pixel. Also fixed: naive UTC serialization that skewed Home's relative timestamps by the device's offset; `SafeAreaProvider` installed as a dependency but never mounted, with `paddingTop: 60` hardcoded across 8 files; trips that could not be renamed or deleted; trip selection that did not survive a restart; trigger deletion orphaning its events; Home resolving geolocation twice per focus; 40 off-theme color literals that survived the CLU-16 reskin.

**Round 2 — ship-readiness and product.** The API base URL was redeclared in six files defaulting to `localhost`, so the app could not work off this machine's WiFi — now centralized in `app/src/api.ts`, with a deploy blueprint at `server/render.yaml`. Failed requests rendered as empty lists, which reads to a tester as data loss — now a distinct error state with retry. Tracking moved from a foreground `watchPositionAsync` haversine loop to OS background geofencing, so alerts finally fire with the app closed, which is what onboarding always promised. Trips can carry coordinates. Home reconciled against the mockup: real SVG progress rings, translucent cards, caps section labels, and a weather high/low the API now returns.

**Gates:** 105 pytest (from 78), 78 frontend tests (from **zero**), `tsc --noEmit` clean. Strategy and device checklist in [TESTING.md](TESTING.md).

## Phase 7 device pass `[x]` done (2026-08-16)

First real device run of Phase 7. Confirmed working: scrolling, safe-area layout, the UTC fix (Latest Alert read "37m ago", not five hours), trip scoping, progress rings as fractions, Home matching the mockup, and background geofencing registering ("Watching 3 zones in the background", correctly excluding the inactive one). Three defects surfaced that no automated layer could have caught.

## Phase 8 — Personal-use readiness `[x]` code complete (2026-08-16), device pass pending

Branch `claude/round-3-personal-use`. Fixes what the device pass found, plus the gap between a demo and something usable for real trips.

**Defects from the device pass.**
- *False geofence alerts.* Registering the seeded Tokyo zones fired three notifications instantly, from India. Two compounding causes: Android evaluates every region at registration and reports the current state as a transition, and the task handler never checked the reported direction against the trigger's own `triggerType` — so an exit on an enter-type zone notified using the enter-worded message. First observation of a region is now a silent baseline; direction mismatches are dropped.
- *Maps rendered black.* The committed Google key was an evaluation key, and Android's Google Maps SDK will not render without a billing-backed one. Replaced `react-native-maps` with MapLibre + OpenFreeMap vector tiles — no key, no billing, no quota. Radius circles are GeoJSON polygons because MapLibre sizes its circle layer in screen pixels, which would keep a geofence visually fixed as the map zooms.
- *Onboarding never got the reskin.* Flat `backgroundColor` values and `paddingTop: 60`, having been built independently of both the CLU-16 reskin and the safe-area work. Now a shared `OnboardingFrame`.

**Personal-use work.** Place search via a Photon-backed `/places` endpoint — destinations, zones and trip locations were previously only creatable by tapping a map and accepting whatever coordinate landed under a fingertip. Proxied through the backend so the upstream is swappable, results are cached against keystrokes, and the User-Agent a free service expects lives in one place; results are biased by device position. Demo data cleared and a `POST /admin/reset` added behind a confirm flag, surfaced as ⚙️ → **Start fresh** on Home, which also reports which server the build points at and warns when that is `localhost`.

**Gates:** 124 pytest (from 105), 100 frontend tests (from 78), `tsc --noEmit` clean.

## Phase 8 device pass `[x]` done (2026-08-17)

Ran on device after a false-start where a stale Metro (started before MapLibre was installed) served an unresolvable bundle and looked like a broken build — the fix was a clean `expo start --clear`, not code (see [TESTING.md](TESTING.md) and the observation log). Confirmed working: MapLibre tiles render (New Delhi / Greater Noida), trip creation with "use my current location" captured real coordinates, place search fields present, onboarding gradients correct. No new defects surfaced. Also cleared the false-geofence-alert regression by construction.

## Phase 9 — Local web harness + Smart trip setup `[x]` code complete (2026-08-17), device pass pending

Branch `claude/round-4-smart-setup`.

**Local web run.** The app now runs in a browser on the dev machine (Expo Web), so most changes can be verified without a phone. `@maplibre/maplibre-react-native` is native-only, so maps come through a platform sibling `MapCanvas.web.tsx` backed by `maplibre-gl`; `geofencing.web.ts` stubs the OS-only geofencing. `scripts/dev.sh` restarts backend + Metro from a clean slate (both cache state at startup and silently serve stale routes/module maps — this bit twice this project). Verified by driving the browser directly: onboarding, Home, maps, place search all work.

**Smart trip setup — the first product "aha".** Creating a trip no longer lands on a blank slate. A `trip_type` (Commute / Day trip / Overnight / Business / Flight / Other) drives `POST /trips/{id}/apply-template`, which seeds a checklist and packing list from `app/templates.py`, layers on a weather-driven item when the trip has coordinates (umbrella for rain, etc., tagged with the condition), and drops a 300m arrival geofence. Idempotent (refuses a second run), and a weather outage degrades to the base template. The New Trip form gains a type picker and shows a summary of what was set up. Verified end-to-end in the browser: a Commute trip auto-populated 3 checklist + 5 packing items.

**Gates:** 140 pytest (from 124), 105 frontend tests (from 100), `tsc --noEmit` clean. No native change — the Phase 8 dev client hot-reloads this over Metro.

## Phase 10 — Commute intelligence, coordinate polish, magic-link auth `[x]` code complete (2026-08-17), device pass pending

Branch `claude/round-5-commute-intel`. Three items, each web-verified in the browser harness.

**Commute intelligence.** Recurring trips: a trip can repeat daily and its checklist is unchecked the first time it's opened on a new local day (`is_recurring` + `checklist_reset_on`, a device-local date; `POST /trips/{id}/reset-checklist`). Packing readiness: Home shows a "Ready to go?" card with what's still unpacked, a commute's Smart Setup also creates a departure (exit) zone at the office, and the geofence exit notification appends the unpacked items ("Still to pack: Charger, Badge").

**Coordinate polish.** A trip's location can be set by place search, not just current-location; trips store a `location_name` and show it ("📍 DLF Cyber Hub, Sector 25A, Gurgaon") instead of raw coordinates. Home rows gained the mockup's chevron.

**Magic-link auth — the app now has real accounts.** Sign in with an email; every trip and item is user-scoped, and cross-account access returns 404. Provider-agnostic: with no `EMAIL_SENDER` configured the magic link is returned in the response (dev mode, one-tap Continue), and setting `EMAIL_SENDER` on deploy flips it to real emailed links with no client change. `users`/`login_tokens`/`sessions` tables plus `user_id` on all six data tables; the test client authenticates by default so the prior suite runs unchanged.

**Gates:** 165 pytest (from 140), 119 frontend tests (from 105), `tsc --noEmit` clean.

## Phase 11 — Caching, drop-a-pin, unified readiness, swipe-to-delete, glass reskin `[x]` code complete (2026-08-18), device pass pending

Branch `claude/round-6-cache-and-pin` ([PR #20](https://github.com/bouai/stepout-clutch/pull/20)). Acts on the second device-test critique. All JS/backend — a Metro reload, not a native rebuild.

**Instant tab switches (caching).** New `useCachedResource` hook (stale-while-revalidate): the last-loaded list shows immediately on re-focus while a fresh copy loads behind it, so Plan / Pack / Go no longer flash empty and re-spin on every switch. Optimistic `mutate` for toggles/deletes; cache cleared on sign-out (no cross-account leak) and between tests.

**Drop-a-pin locations.** Proved OSM (Photon *and* Nominatim) genuinely can't find Noida-office addresses by name (control "Infosys Bangalore" works — it's an OSM data gap, not our integration). So a new `MapPicker` drops a pin and `GET /places/reverse` names it from the nearest mapped feature. Search-by-name stays for places OSM knows.

**Unified readiness.** Home's two rings + readiness card collapsed into one "You're X% ready" figure over the combined checklist+packing count.

**Swipe-to-delete.** The always-visible red "Delete" link on every list row (admin-table feel) replaced with swipe-left-to-reveal, built on `PanResponder`/`Animated` — no gesture-handler, no native module. The delete action mounts only while swiping so nothing bleeds through the translucent cards.

**Full glass reskin.** Extended the frosted-glass treatment (previously only Home's weather card) across every screen: a shared `glassCard` token, light-on-gradient text, checkboxes, and ring. Modals and the trip-setup form stay opaque white with dark text.

**Gates:** 167 pytest (from 165), 119 frontend tests, `tsc --noEmit` clean. Web-verified in the Expo harness (glass surfaces + white text confirmed via computed styles; swipe reveal confirmed).

## Next up

- **Device pass** on Phase 9 + 10 + 11 (Smart Setup, commute intelligence, auth, caching, drop-a-pin, swipe, glass). Mostly a Metro reload; confirm nothing regressed natively. Background geofencing's exit bookend and the unpacked-items notification can only be seen on hardware; the swipe gesture *feel* (open threshold, scroll-vs-swipe arbitration) needs a real thumb.
- **Deploy** (still deferred). `server/render.yaml` is ready and now carries the `EMAIL_SENDER` hook; deploying unblocks off-LAN use and real emailed magic links.

## Known risks

- **Open:** no device pass yet for Phase 9's Smart Setup (JS-only, so just a Metro reload, not a rebuild). The web harness verified the flow, but the phone pass is still owed.
- **Open:** two free third-party services are on the critical path — OpenFreeMap (tiles) and Photon (geocoding). Both keyless, both run by others; swappable in one place each (`MAP_STYLE_URL`, `PHOTON_URL`).
- **Open:** no device pass yet for Phase 8's earlier state. MapLibre and background-location changes both need a native rebuild, and the geofence baseline fix can only be confirmed by walking a real boundary.
- **Open:** the backend is not deployed, so only devices on this machine's LAN can use the app and it cannot be handed to a tester. `server/render.yaml` is ready; deploying needs a Render account.
- Free-tier deployment caveats that will affect testers: the service sleeps after ~15 min idle (~50s cold start, which looks like a timeout in the app), and free Postgres expires after 30 days.
- **No migration tooling.** `create_all` only creates missing tables; it never adds a column to an existing one. After a schema change run `python seed_demo.py --reset`.
- **Third-party free services now on the critical path.** OpenFreeMap serves map tiles and Photon serves geocoding; both are free, keyless and run by others. If either degrades, maps or search go with it. Both are swappable in one place (`MAP_STYLE_URL` in `app/src/components/MapCanvas.tsx`, `PHOTON_URL` in `server/app/routers/places.py`).
- Phase 3's scope risk resolved without a size surprise — the actual incident was the CLU-16/CLU-17 file collision (see above), not a Phase 3 scope blowup.
- `expo-notifications` is permanently broken on Expo Go/Android (Expo's own intentional design, SDK 53+) — testing must go through an EAS dev-client build from here on, not Expo Go.
- Each EAS dev-client rebuild takes ~10–15 min — batch device-testing checkpoints rather than rebuilding after every change.

## Environment notes (for a fresh session)

- Expo SDK 57 project. Play Store's Expo Go lags SDK support by design (review queue) — irrelevant now that a dev-client build exists, but relevant if the dev-client ever needs reinstalling from scratch.
- EAS project: `@abhisheksr29/stepout`, `eas.json` has a `development` profile (APK, internal distribution). Rebuild with `npx eas-cli build --profile development --platform android` from `app/`.
- Backend dev run (LAN-accessible for phone testing): `python -m uvicorn app.main:app --host 0.0.0.0 --port 8000` from `server/`.
- Frontend dev run: `EXPO_PUBLIC_API_URL=http://<LAN_IP>:8000 npx expo start` (or `npx expo start --dev-client` once the dev-client is installed on-device), from `app/`.
- This machine needed `git config --global --add safe.directory D:/Dev/stepout-clutch` and the same with `/.git` appended — EAS's upload step shells out to `git clone` and Windows ownership metadata trips Git's dubious-ownership check otherwise.
