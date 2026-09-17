# Khaali (खाली)

> Production-ready, mobile-first classroom vacancy finder for IILM University (School of Computer Science & Engineering, Greater Noida).

[![Next.js 15](https://img.shields.io/badge/Next.js-15-black?style=flat&logo=next.js)](https://nextjs.org/)
[![React 19](https://img.shields.io/badge/React-19-blue?style=flat&logo=react)](https://react.dev/)
[![TypeScript Strict](https://img.shields.io/badge/TypeScript-Strict-3178C6?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38B2AC?style=flat&logo=tailwind-css)](https://tailwindcss.com/)
[![Vitest](https://img.shields.io/badge/Tests-35%20Passed-FCC72B?style=flat&logo=vitest)](https://vitest.dev/)

---

## The Problem
The SoCSE timetable is published per-batch across dozens of different sections on an EduPage/aSc Timetables instance. Students routinely have 1–3 hour gaps between classes with nowhere to study, while classrooms sit empty in the same building. There is no unified view showing which rooms are free across all batches.

## The Solution
**Khaali** is a departure-board styled web application that:
1. Auto-detects the current day and period in Asia/Kolkata (IST).
2. Evaluates the union of all 125 batches' schedules in $O(1)$ time.
3. Automatically filters out hardware laboratories (`Apple Lab`, `Dell Lab`, `LAB SVH...`).
4. Computes contiguous **free-runs** and ranks vacant rooms by **remaining duration**, so students instantly know where they can sit and until when.
5. Answers the primary user story within 2 seconds of page load with **zero taps**.

---

## Layout & Departure Board Aesthetic

```text
┌──────────────────────────────────────────────┐
│ KHAALI                           Wed · 12:47 │  ← Live IST Clock & wordmark
├──────────────────────────────────────────────┤
│ BATCH: 2BCA1                        [Change] │  ← Personalized gap tracker
│ You're free 12:40–13:35                      │     Nearest vacant: EB 201, EB 207
├──────────────────────────────────────────────┤
│ Wed · Period 5 (12:40–13:35)             [▼] │  ← Collapsed time selector
├──────────────────────────────────────────────┤
│   EB 305                                     │  ← HERO: The single best room
│   free for 2h 45m                            │     Large mono code, duration in green
│   until 15:25 · 3rd floor · EB               │
├──────────────────────────────────────────────┤
│ 13 more rooms free now                       │
│                                              │
│ ▸ EB 201      2h 45m (until 15:25)   2nd fl  │  ← Scannable departure board rows
│ ▸ EB 207      2h 45m (until 15:25)   2nd fl  │
│ ▸ FB 102      2h 45m (until 15:25)   1st fl  │
│ ...                                          │
├──────────────────────────────────────────────┤
│ ▸ Never scheduled — may not be usable (4)    │  ← Partitioned storage/staff rooms
├──────────────────────────────────────────────┤
│  All    EB    FB    SVH    Law               │  ← Sticky bottom filter chips (44px)
└──────────────────────────────────────────────┘
```

---

## Core Features

- **Instant Hero Answer**: Single best vacant room displayed in ~40px monospaced typography with remaining duration.
- **Duration-First Ranking**: Rooms free for multiple consecutive periods are prioritized over 1-period slots.
- **Deterministic Room Abbreviations**: Flap rows display clean room codes (e.g. `EB 305`, `FB 303`, `LAW 301`) derived deterministically from building blocks and room numbers, while preserving full room names for tooltips and accessibility.
- **Personal Layer ("Your Next Gap")**: Select your batch (e.g. `2BCA1`, `1CSE4`) saved to `localStorage` to view your next break and nearest vacant classrooms.
- **Faculty & Room Schedule Inquiry**: Instant lookup for faculty schedules and classroom multi-period timelines with full focus trap and back-button history navigation.
- **Mobile Swipe & Desktop Keyboard Navigation**:
  - `←` / `→`: Cycle timetable day (Mon – Sat).
  - `↑` / `↓`: Cycle timetable period slot (1 – 9).
  - `/`: Quick search faculty or room profiles.
  - `?`: Toggle keyboard & gesture guide modal.
  - `ESC`: Dismiss active dialogs.
  - Touch Swipes: Horizontal swipe left/right (>40px) on the time selector bar smoothly advances/retreats period slots.
- **Shareable Deep Links**: URL parameters (`/?day=wed&period=5&building=EB`) automatically reflect selection and round-trip cleanly.
- **Automatic Daily Sync & Resilient Persistence**:
  - Daily Vercel Cron at **09:30 IST** (`0 4 * * *` UTC) captures morning substitutions and room updates.
  - Timetable data is persisted as an atomic snapshot in **Vercel Blob** (with automatic local file cache fallback for offline runs).
  - 26-hour staleness threshold ensures instant zero-latency page loads while keeping cached schedules fresh.
  - Manual resync trigger via `/api/cron/sync-timetable?key=...`.
- **PWA Ready**: Web App Manifest, Service Worker (cache-first for shell, network-first for data), and home-screen installable.
- **Dark & Light Modes**: High contrast departure board with persistent theme toggle (WCAG AA compliant).

---

## Automatic Daily Synchronization & Persistence

### 1. Vercel Cron Schedule
- **Time**: 09:30 IST (Asia/Kolkata = UTC+5:30 with no DST) $\rightarrow$ **04:00 UTC**.
- **Cron Expression**: `0 4 * * *` configured in `vercel.json`.
- **Rationale**: College classes begin at 09:00 IST. The cron triggers at 09:30 IST to capture morning departmental substitution notices, teacher leaves, and room reassignments before students enter their mid-day breaks.

### 2. Persistence Layer: Vercel Blob + Local File Fallback
- **Vercel Blob**: The entire normalized timetable (~150 KB JSON payload) is stored atomically in Vercel Blob (`timetable/store.json`). This eliminates database connection pools, cold start overhead, and complex SQL migrations.
- **Offline & CI Fallback**: When `BLOB_READ_WRITE_TOKEN` is not present (e.g. in Vitest test runs, local offline development, or build pipelines), the store automatically falls back to an atomic local file cache (`.next/cache/timetable-store.json` or `/tmp`), ensuring zero test failures in air-gapped environments.
- **Staleness Threshold**: Set to **26 hours** (`STALENESS_THRESHOLD_MS`). If the stored snapshot is under 26 hours old, `/api/timetable` serves it directly. If the store is stale or absent, the route performs a live scrape to EduPage, saves the fresh snapshot, or gracefully falls back to the last-known-good snapshot.

### 3. Manual Re-Sync Trigger
You can force an immediate resync without waiting for the scheduled cron run:
```bash
# Via Bearer Token
curl -X GET "https://khaali.vercel.app/api/cron/sync-timetable" \
  -H "Authorization: Bearer <CRON_SECRET>"

# Or via Query Param / Debug Header
curl -X GET "https://khaali.vercel.app/api/cron/sync-timetable?key=<DEBUG_KEY>"
```

### 4. EduPage RPC Cadence & Sensitivity Observations
During architectural reverse engineering of EduPage (`regulartt.js`, `substitution.js`, `ttviewer.js`), several key operational behaviors were noted:
- **Session State & Rate Limiting**: EduPage tracks client sessions using PHP session cookies (`PHPSESSID`). Making rapid concurrent requests across multiple periods or batches without carrying forward session cookies triggers EduPage's anti-scraping guard (`reload: true` responses or HTTP 503 drops).
- **Sequential Ingestion**: Khaali's ingest pipeline batches queries sequentially with retry backoff rather than launching burst calls.
- **Shielding the Origin**: Without centralized storage, every student opening Khaali would trigger upstream calls to the college's EduPage server. The daily 09:30 IST cron job and Vercel Blob store shield the university servers completely, allowing hundreds of students to query room vacancies concurrently with sub-50ms response times.

---

## Tech Stack

- **Framework**: Next.js 15 (App Router, Server Components, TypeScript Strict Mode)
- **Styling**: Tailwind CSS with CSS Custom Properties
- **Data Validation**: Zod
- **Testing**: Vitest (100% offline against recorded raw fixtures)
- **Persistence**: Vercel Blob + Local Atomic Cache Fallback
- **Zero Runtime UI Bloat**: No UI component libraries, no external icon packs (inline vector SVGs only), sub-115KB gzipped first load JS.

---

## Project Structure

```text
khali/
├── fixtures/
│   └── regulartt.raw.json         # Full raw timetable snapshot (offline tests)
├── public/
│   ├── icon.svg                   # Vector PWA icon
│   ├── icon-192.png               # 192x192 PWA app icon
│   ├── icon-512.png               # 512x512 PWA splash icon
│   └── sw.js                      # Cache-first PWA Service Worker
├── scripts/
│   ├── probe.mjs                  # RPC exploration & fixture capture
│   └── inspect_rooms.mjs          # Classroom derivation inspector
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── cron/
│   │   │   │   └── sync-timetable/# Vercel Cron daily sync route (09:30 IST)
│   │   │   ├── debug/route.ts     # Schema diagnostics (?key=khaali-debug)
│   │   │   ├── substitutions/     # Daily substitutions endpoint
│   │   │   └── timetable/         # Base timetable endpoint (serves Blob store)
│   │   ├── globals.css            # Design tokens & color system
│   │   ├── layout.tsx             # Fonts & metadata
│   │   ├── manifest.ts            # Web App Manifest route
│   │   └── page.tsx               # Server-rendered home view
│   ├── components/
│   │   ├── DayTabs.tsx            # Day selector (min 44px)
│   │   ├── FilterChips.tsx        # Building filter buttons (min 44px)
│   │   ├── HeroAnswer.tsx         # Best vacant room display
│   │   ├── KeyboardShortcutsModal.tsx # Shortcuts & gesture guide modal
│   │   ├── KhaaliClient.tsx       # Live client orchestrator
│   │   ├── MyGapCard.tsx          # Batch gap tracker
│   │   ├── PeriodPicker.tsx       # Period grid (min 44px)
│   │   ├── RoomRow.tsx            # Scannable departure row with short codes
│   │   ├── SearchModal.tsx        # Professor & room inquiry with focus trap
│   │   ├── StatusBanner.tsx       # Amber warnings & validity check
│   │   └── TimeSelectorBar.tsx    # Touch-swipeable time selector bar
│   ├── data/
│   │   └── overrides.json         # Forced lab / room name overrides
│   └── lib/
│       ├── domain/
│       │   ├── occupancy.ts       # Multi-period & split card expansion
│       │   ├── rooms.ts           # Short room abbreviation engine
│       │   ├── time.ts            # Asia/Kolkata IST period detection
│       │   └── vacancy.ts         # Vacancy subtraction & ranking
│       ├── edupage/
│       │   ├── client.ts          # Server-side RPC transport with retries
│       │   ├── parse.ts           # Raw tables -> domain models
│       │   ├── schema.ts          # Zod schema validation
│       │   └── substitutions.ts   # Substitution HTML parser & merger
│       └── storage/
│           └── timetable-store.ts # Vercel Blob persistence & local fallback
├── test/
│   └── domain/                    # 42 offline unit tests
└── vercel.json                    # Cron configuration (09:30 IST)
```

---

## Getting Started

### 1. Prerequisites
- Node.js 18.18+ or 20+ (tested on Node v24)
- npm 9+

### 2. Installation
```bash
git clone <repo-url>
cd khali
npm install
```

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Run Offline Test Suite
```bash
npm run test
```
Runs 42 tests covering deterministic short room derivations, overrides propagation, group splits (2BCA1 Apple/Dell Lab), multi-period unrolling, IST period detection, and full-period hand verification against the fixture.

### 5. Typecheck & Production Build
```bash
npm run typecheck
npm run build
npm run start
```

---

## Diagnostics & Resync Endpoints

- **Diagnostics**:
  ```text
  http://localhost:3000/api/debug?key=khaali-debug
  ```
- **Manual Timetable Resync**:
  ```text
  http://localhost:3000/api/cron/sync-timetable?key=khaali-debug
  ```

---

## Disclaimer

**Khaali is an unofficial student utility.** Timetable data is sourced from publicly published schedules of the School of Computer Science & Engineering, IILM University Greater Noida. Always verify with official department notices before relying on classroom availability.
