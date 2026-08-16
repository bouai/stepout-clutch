# Testing StepOut

Three layers. The first two run on this machine in seconds; the third needs a
phone and is the only one that can see GPS, notifications, map tiles and real
layout.

| Layer | Command | Runtime | Catches |
|---|---|---|---|
| Backend | `cd server && python -m pytest -q` | ~2s | API correctness, scoping, serialization |
| Frontend | `cd app && npm test` | ~8s | rendering, empty/error states, reachability |
| Device | EAS dev client (below) | ~15 min to build | GPS, notifications, maps, real layout |

Run the first two before every commit. The third is a checkpoint, batched —
each native rebuild costs 10–15 minutes.

## Why the third layer cannot be skipped

Both automated layers were green across 16 merged issues while four of five
screens had no scroll container at all — every list row past the first
screenful was unreachable. Types compiled, the API returned correct JSON, and
the data simply never became reachable pixels. There are now explicit
reachability tests (`src/screens/__tests__/screens-scroll.test.tsx`), but the
general lesson holds: green gates certify only what they measure.

## Layer 1 — Backend

```bash
cd server && python -m pytest -q
```

Uses an in-memory SQLite database per test; no server or seed data needed.

## Layer 2 — Frontend

```bash
cd app && npm test
```

`jest-expo` + React Native Testing Library. Native modules (location,
notifications, maps, async-storage, safe-area) are mocked in `jest.setup.js`.
`fetch` is stubbed per test via `stubFetch` in `src/test-utils.tsx` and fails
loudly if a test forgets to register a route.

Note: RNTL v14's `render` is **async**. Always `await` it:

```ts
const view = await renderWithProviders(<HomeScreen />);
```

## Layer 3 — Device

### One-time per native change

A dev client only needs rebuilding when **native** code changes — a new native
module, or an `app.json` plugin/permission/config change. Pure JS and
devDependency changes hot-reload over Metro against the existing binary.

```bash
cd app && npx eas-cli build --profile development --platform android
```

Install the resulting APK. Check what the installed binary was built from
before assuming it can run current `main`:

```bash
cd app && npx eas-cli build:list --platform android --limit 1
```

If commits since that build added a native module, the dev client will fail to
resolve it at runtime — usually as a red screen on launch, not a clear error.

### Every session

Seed the database once so screens aren't empty:

```bash
cd server && python seed_demo.py --reset
```

`--reset` drops and recreates the tables. Needed after any schema change:
`create_all` only creates missing *tables*, never adds a column to an existing
one — there is no migration tooling in this project yet.

Start the backend bound to the LAN, not just localhost:

```bash
cd server && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Start Metro pointed at this machine's LAN IP (phone must be on the same
network):

```bash
cd app && EXPO_PUBLIC_API_URL=http://192.168.1.9:8000 npx expo start --dev-client
```

Confirm the IP first — it changes between networks:

```bash
powershell -c "Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' } | Select IPAddress, InterfaceAlias"
```

### Checklist

Seeded data is deliberately asymmetric: **Tokyo** is dense (10 checklist items,
12 inventory items, 5 destinations, 4 triggers, 2 alerts), **Lisbon** is nearly
empty, and one inventory item belongs to no trip. Switching trips should
visibly change every card.

**Onboarding** — needs a fresh install, or clear app data first.
- [ ] Welcome → Enable Location → Enable Notifications, dots track the step
- [ ] Permission prompts appear and both grants are accepted
- [ ] Finishing lands on Home
- [ ] Force-quit and relaunch → onboarding does **not** reappear

**Layout** — the class of bug that survived 16 merged issues.
- [ ] Every screen scrolls; the last card is fully reachable
- [ ] Nothing hides behind the floating nav
- [ ] The nav clears the gesture bar / on-screen buttons
- [ ] Status bar icons are legible against the coral gradient
- [ ] No white system header above any screen
- [ ] Pull-to-refresh works on Home, Plan and Pack

**Trips**
- [ ] Chips show All / Tokyo / Lisbon / +
- [ ] Selecting Tokyo fills every card; Lisbon nearly empties them
- [ ] Long-press a chip → Rename and Delete
- [ ] Rename persists after leaving and returning to the screen
- [ ] Delete keeps the trip's items and moves them to All
- [ ] **Force-quit and relaunch → the selected trip is still selected**

**Home**
- [ ] Weather shows Tokyo's, not the device's, when Tokyo is selected
- [ ] Progress rings match the Plan and Pack tabs
- [ ] Up Next shows the nearest destination with a plausible distance
- [ ] Latest Alert reads **"12m ago"**, not several hours — this is the UTC fix
- [ ] Latest Alert changes with the selected trip

**Plan / Pack**
- [ ] Toggle, edit-by-tap, add and delete all work
- [ ] Checking a linked item updates the 📦 badge
- [ ] A failed write shows a row error and rolls back (test with the server stopped)

**Go / Track** — the physical layer.
- [ ] Map tiles render (a grey grid means the Maps key is rejected)
- [ ] Current-location marker appears
- [ ] Tap the map → trigger modal; the radius circle previews live
- [ ] Walk out of a small trigger → notification fires
- [ ] That alert then appears on Home with a fresh relative time

### Known limitation

Tracking is **foreground-only**. `watchPositionAsync` stops when the app is
backgrounded, so geofences only fire while the app is open on the Track tab.
Background geofencing needs `expo-task-manager` plus background location
permission — a feature, not a fix.
