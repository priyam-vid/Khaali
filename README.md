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
│ KHAALI  SoCSE                    Wed · 12:47 │  ← Live IST Clock & wordmark
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
- **Personal Layer ("Your Next Gap")**: Select your batch (e.g. `2BCA1`, `1CSE4`) saved to `localStorage` to view your next break and nearest vacant classrooms.
- **Faculty Lookup**: Instant search for faculty members (e.g. *"where is Mr. Vikas Singh right now?"*).
- **Classroom Day Schedule**: Look up any room to see its full 9-period schedule.
- **Shareable Deep Links**: Direct link sharing via URL query parameters (`/?day=wed&period=5&building=EB`).
- **Resilient Upstream Caching**:
  - `/api/timetable`: ISR cached for **1 hour** (`revalidate = 3600`).
  - `/api/substitutions`: ISR cached for **5 minutes** (`revalidate = 300`).
  - Server-side fallback serving verified cached payloads with amber warnings if upstream is unreachable.
  - Client-side `localStorage` cache for campus Wi-Fi dropouts.
- **PWA Ready**: Web App Manifest, Service Worker (cache-first for shell, network-first for data), and home-screen installable.
- **Dark & Light Modes**: High contrast departure board with persistent theme toggle (WCAG AA compliant).

---

## Tech Stack

- **Framework**: Next.js 15 (App Router, Server Components, TypeScript Strict Mode)
- **Styling**: Tailwind CSS with CSS Custom Properties
- **Data Validation**: Zod
- **Testing**: Vitest (100% offline against recorded raw fixtures)
- **Zero Runtime UI Bloat**: No UI component libraries, no icon packs (inline vector SVGs only), sub-100KB gzipped first load JS.

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
│   │   │   ├── debug/route.ts     # Schema diagnostics (?key=khaali-debug)
│   │   │   ├── substitutions/     # ISR 300s intraday changes
│   │   │   └── timetable/         # ISR 3600s base timetable
│   │   ├── globals.css            # Design tokens & color system
│   │   ├── layout.tsx             # Fonts & metadata
│   │   ├── manifest.ts            # Web App Manifest route
│   │   └── page.tsx               # Server-rendered home view
│   ├── components/
│   │   ├── DayTabs.tsx            # Day selector
│   │   ├── FilterChips.tsx        # Building filter buttons (min 44px)
│   │   ├── HeroAnswer.tsx         # Best vacant room display
│   │   ├── KhaaliClient.tsx       # Live client orchestrator
│   │   ├── MyGapCard.tsx          # Batch gap tracker
│   │   ├── PeriodPicker.tsx       # Period grid
│   │   ├── RoomRow.tsx            # Scannable departure row
│   │   ├── SearchModal.tsx        # Professor & room schedule lookup
│   │   ├── StatusBanner.tsx       # Amber warnings & validity check
│   │   └── TimeSelectorBar.tsx    # Collapsed single-line bar
│   ├── data/
│   │   └── overrides.json         # Forced lab / room name overrides
│   └── lib/
│       ├── domain/
│       │   ├── occupancy.ts       # Multi-period & split card expansion
│       │   ├── rooms.ts           # Building & floor regex, lab detection
│       │   ├── time.ts            # Asia/Kolkata IST period detection
│       │   └── vacancy.ts         # Vacancy subtraction & ranking
│       └── edupage/
│           ├── client.ts          # Server-side RPC transport with retries
│           ├── parse.ts           # Raw tables -> domain models
│           ├── schema.ts          # Zod schema validation
│           └── substitutions.ts   # Substitution HTML parser & merger
└── test/
    └── domain/                    # 35 offline unit tests
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
Runs 35 tests covering room derivation, group splits (2BCA1 Apple/Dell Lab), multi-period unrolling, IST period detection, and full-period hand verification against the fixture.

### 5. Typecheck & Production Build
```bash
npm run typecheck
npm run build
npm run start
```

---

## Diagnostics Endpoint

A gated diagnostics route is available to inspect raw parsing, derived room counts, and active period detection:

```text
http://localhost:3000/api/debug?key=khaali-debug
```
*(Configure `process.env.DEBUG_KEY` in production).*

---

## Disclaimer

**Khaali is an unofficial student utility.** Timetable data is sourced from publicly published schedules of the School of Computer Science & Engineering, IILM University Greater Noida. Always verify with official department notices before relying on classroom availability.
