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

## Phase 0–1 — Stabilization `[~]`

First real on-device test (2026-08-09, EAS dev-client build on Android) surfaced gaps beyond what pytest/tsc could catch. Audited every router + every prior loop's non-goals; found:

| Issue | Gap | Why it matters | Status |
|---|---|---|---|
| CLU-12 (Loop 8) | ChecklistItem↔InventoryItem link never wired up despite FK existing since Loop 1 | Planner and Inventory pack status fully disconnected | `[ ]` filed, `agent-ready`, not built |
| CLU-13 (Loop 9) | No Google Maps Android API key configured | **Confirmed crash** on Active Tracking; Transit unverified but same risk | `[x]` **done** — used a free no-billing Google Maps Demo Key (see note below), EAS dev-client rebuilt, both maps confirmed rendering on-device (map tiles render black under the demo key — cosmetic, not a crash; app's own markers/circles/overlays are unaffected) |
| CLU-14 (Loop 10) | No `DELETE` on ChecklistItem / InventoryItem | Items are permanent once added | `[ ]` filed, `agent-ready`, not built |
| CLU-15 (Loop 11) | No `PATCH`/`DELETE` on GeofenceTrigger | Triggers can't be deactivated or removed from the app once created | `[ ]` filed, `agent-ready`, not built |

CLU-12/14/15 are all labeled `agent-ready` and queued for the `clutch-build` loop — independent of each other, any order.

**Note on the Maps key:** used Google's free "Demo Key" (`mapsplatform.google.com/maps-demo-key`) — no billing account, no credit card, works for Maps SDK for Android specifically. Dev/testing only (daily quota, not for production) — revisit with a real billing-backed key only when this app is heading toward real users. Key lives in `app/app.json` under `expo.android.config.googleMaps.apiKey`.

## Design direction

Local export: `Stepout_app_design_v1/` (repo root) — 5 mockup frames in `screenshots/`, plus `StepOut App.dc.html` / `StepOut Deck.dc.html`. Source tool link (private, not fetchable outside the user's own browser session): `https://claude.ai/design/p/12462dca-0a24-4d7f-8f38-cf96dcb45bde`.

Mockups show: 3-screen onboarding (Welcome/Location/Notifications), a new 5th "Home" tab (dashboard), and the 4 existing tabs relabeled **Plan / Go / Track / Pack** (= Planner / Transit / Active Tracking / Inventory). Visual system: coral→purple gradient background, bold rounded sans headings, white rounded-24 cards with soft shadow, pill-shaped floating bottom nav, coral pill CTAs.

Home introduces two concepts that don't exist in the data model yet: a **Trip** (multi-trip selector — "Tokyo / Lisbon / +") and a persisted **alert/event log** ("Entered Shinjuku Ward · 5:41 AM"). Both are new backend entities, not styling.

## Phase 2–6 — Redesign `[ ]` (blocked on Phase 0–1)

```
Phase 2 (reskin) ── establishes shared style tokens
        │
        ▼
Phase 3 (trip model) ──┐
Phase 4 (event log) ───┤  can overlap, both backend-first
        │              │
        └──────┬───────┘
               ▼
        Phase 5 (Home dashboard)

Phase 6 (onboarding) — no dependencies, can slot in anytime after Phase 2
```

**Phase 2 — Visual reskin.** Restyle Plan/Go/Track/Pack to the new visual system (shared theme constants: colors/radii/spacing/typography), rename tabs, zero behavior change. Open gap: mockups only show Home + Plan + onboarding — Transit/Active Tracking's own internals (map layout, trigger list, modals) have no reference mockup, will need extrapolation and a review pass before Phase 5 locks it in.

**Phase 3 — Trip data model** (highest risk/effort). New `trips` table; nullable `trip_id` FK added to `checklist_items`, `inventory_items`, `saved_destinations`, `geofence_triggers`; migrate existing rows onto an auto-created "Default Trip"; scope all list endpoints by `trip_id`; frontend trip-switcher shared across all 4 screens. Touches every existing router and screen — split into backend-scoping + frontend-switcher sub-loops if it proves too large for one pass.

**Phase 4 — Alert/event log.** New `geofence_events` table (trigger_id, fired_at, direction); Active Tracking POSTs an event each time it fires a local notification; `GET /geofence-events` (latest-first) powers Home's "Latest Alert" card.

**Phase 5 — Home dashboard.** New 5th tab; depends on Phase 3 + 4. Weather card (current trip's location), checklist/packing progress rings (current trip's data), "Up Next" nearest destination (reuses existing `/saved-destinations/{id}/distance`), "Latest Alert" (Phase 4).

**Phase 6 — Onboarding.** 3-screen first-run flow, shown once, replacing the ad-hoc permission prompts currently scattered across Planner and Active Tracking. No dependencies.

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
