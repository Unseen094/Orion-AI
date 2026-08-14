# ORION — Execution Plan & Product Specification

> **The Open-Source AI Operating System**
> A 30-hour AI hackathon plan. Optimized for demo quality, innovation, stability, polish, speed of development, judge perception, and "wow factor." Not optimized for production-readiness.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Winning Strategy](#2-winning-strategy)
3. [Architecture](#3-architecture)
4. [Project Structure](#4-project-structure)
5. [Implementation Order](#5-implementation-order)
6. [Hour-by-Hour Timeline](#6-hour-by-hour-timeline)
7. [Development Checklist](#7-development-checklist)
8. [Demo Script](#8-demo-script)
9. [Judge Q&A Preparation](#9-judge-qa-preparation)
10. [Future Roadmap](#10-future-roadmap)

---

## 1. Executive Summary

Orion is not a chatbot. It's an **AI Operating System** — a crimson, dot-matrix OS shell that shapes itself around whatever you ask it to do. You type *"build me a React dashboard"* and instead of a chat reply, an entire **Coding Yard** opens around you with a file explorer, a Monaco editor, and an AI that starts building. You type *"research quantum computing"* and a **Research Yard** with search, summaries, and notes opens instead. This is the Yard system, and it is the one thing judges will remember.

**The winning bet:** every other team demos a chat window. We demo an *operating system* — a boot sequence, an animated particle orb with distinct thinking/listening/executing states, a left sidebar (Home / Yards / Plugins / Models / Settings), a persistent AI chat, and Yards that open with buttery Framer Motion springs. The AI doesn't just talk; it **does** (opens the right Yard, writes code into the editor, controls the mouse/keyboard).

**Locked decisions (non-negotiable):**

- **Web-first. No Tauri.** The OS illusion comes from a fullscreen React app + boot sequence, not a desktop shell. This deletes the single biggest build risk in the stack (Rust toolchain, WebView quirks). If we finish everything early, Tauri becomes a stretch goal — never a dependency.
- **FastAPI backend** owns AI orchestration, computer control, persistence, and the MCP-shaped tool layer. The browser never talks to Gemini directly except through us.
- **Demo-first engineering.** Any feature that can't look *finished* in 3 hours gets cut. Simulated backend logic is a first-class citizen — "Offline/Demo mode" is a feature we demo, not a bug we hide.
- **One polished thing > five half things.** We ship: Home + Orb + Auto Yard Switching + Coding Yard + Research Yard + Computer Control + Settings. Nothing else.

The centerpiece demo moment: the user types a task, the orb *thinks*, the correct Yard *slides open automatically*, and the AI starts performing inside that context. That single interaction — **intent → Yard** — is the pitch, the innovation, and the "wow."

---

## 2. Winning Strategy

Judges will see 50 chat UIs. They will remember **one operating system**. Strategy in three pillars:

### Pillar 1 — The Illusion of an OS (visual identity)

- Crimson/black/white, dot-grid backgrounds, glowing accents. Everything must look *designed*, not *built*.
- A **boot sequence** (logo, sweeping dots, `INITIALIZING ORION`) so opening the app feels like turning on a machine.
- The **Orb** with four explicit states — Idle / Thinking / Listening / Executing — each visibly different. This is the product's face. It gets more polish hours than any single feature.
- Micro-animations everywhere: sidebar active-dot indicators, card hovers, yard spring-open transitions, streaming caret, subtle sounds.

### Pillar 2 — The Magic Moment (the demo core)

> User types: *"Open a coding yard and build me a to-do app."*
> Orb → **Thinking**. Yard decision fires (heuristic + Gemini). **Coding Yard slides open**. AI generates a project skeleton into the file explorer, writes code into Monaco, streams its reasoning in the right chat panel, and — optionally — *types a real command* via computer control.

This one flow touches every headline feature. Everything else is support.

### Pillar 3 — Total Reliability

- Rehearse the exact demo 5+ times. A crash loses more points than a missing feature gains.
- **Everything works offline.** Seeded demo project, local research dataset, cached Gemini responses, vendored assets, pre-installed `node_modules`. Venue Wi-Fi is a liability, not an assumption.
- Every risky feature has a **simulation mode** that looks identical on screen.

### Decision Rulebook (apply to everything)

1. **Most impressive** → **fastest** → **least likely to fail**.
2. Fake it if it demos better. (Research search falls back to a curated local dataset when the network is down — judges see identical UI.)
3. Animations > hidden complexity. A glowing orb is worth more than a correct type signature.
4. No auth, no cloud, no marketplace, no 50 providers, no complex memory, no production security. Ever.

---

## 3. Architecture

### 3.1 High-level diagram

```
┌──────────────────────────────────────────────────────────────┐
│                         BROWSER (React)                      │
│  ┌──────────┐  ┌──────────────────────────┐  ┌────────────┐ │
│  │ Sidebar  │  │   Home / Yard Workspaces │  │ Chat Panel │ │
│  │ nav+dots │  │  (Coding, Research, ...) │  │ (persist)  │ │
│  └──────────┘  └──────────────────────────┘  └────────────┘ │
│        ▲                   ▲                      ▲         │
│        │  REST (SSE stream)│ REST                 │ REST    │
└────────┼───────────────────┼──────────────────────┼─────────┘
         ▼                   ▼                      ▼
┌──────────────────────────────────────────────────────────────┐
│                        BACKEND (FastAPI)                     │
│  Router layer: chat / yards / projects / research / system / │
│                settings / mcp                                │
│  Orchestrator: decides + routes intent → Yard + tools        │
│  Heuristic:  fast keyword classifier (sync safety net)       │
│  Tools (MCP-shaped): SystemTools, ProjectTools, SearchTools, │
│                      NotesTools   (list_tools/execute)       │
│  Persistence: SQLite (settings, projects, notes, history)    │
│  Computer Control: pyautogui wrapper + simulation mode +     │
│                    kill-switch                               │
└───────────────────────────────┬──────────────────────────────┘
                                │
                     ┌──────────┴──────────┐
                     ▼                     ▼
              GEMINI (BYOK)          Local fallback /
              decision + generation  seeded dataset / canned
                                     responses (Offline mode)
```

### 3.2 Data flow for the Magic Moment

1. User sends a message from the right chat panel (SSE endpoint).
2. Backend runs **heuristic classifier** on the text (keywords → `coding`/`research`/`home`).
3. Backend calls Gemini decision call (structured JSON output): `{yard, action, reason, confidence}`.
4. If a Yard should open, orchestrator returns an event `{type: "yard.open", yard}`; frontend runs the spring animation.
5. Backend then makes the **generation call**, injecting the opened Yard's system prompt (tools, context). Tool calls (file writes, search, system actions) dispatch through the MCP-shaped tool layer.
6. Response + tool activity stream back as SSE events; chat renders typewriter text; orb switches Thinking → Executing → Idle.

### 3.3 Key architecture choices (opinionated)

- **SSE, not WebSockets.** Simpler, works through any proxy, trivially streams tokens. Chat + events ride one stream as JSON-lines (`data: {"type":"token","text":"..."}`).
- **Zustand for client state, no Redux.** Server state is fetched in effects via a tiny `api.ts` client — React Query is optional and cut if time runs short.
- **FastAPI > Node backend** because pyautogui (computer control) and the offline/research datasets are Python-native, and `httpx` + Gemini streaming is trivial.
- **Monaco lazy-loaded** after first paint so the home screen is instant.
- **The tool layer IS the MCP story.** A single `ToolProvider` interface (`list_tools()`, `execute(tool, args)`) with concrete providers is both our internal tool dispatch *and* the documented seam where a real MCP server plugs in later. Judges who ask "where's MCP?" get pointed at `mcp_adapter.py` + `/api/mcp/execute`.

### 3.4 Communication contract

- REST for everything stateful; SSE (`/api/chat/stream`) for all AI output.
- All JSON. TypeScript types mirrored as pydantic models; keep a small `shared/types.ts` if the mirror drifts.

### 3.5 API endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/health` | Liveness check |
| `POST` | `/api/chat/stream` | SSE stream — send message; emits tokens, `yard.open`, tool events, done |
| `POST` | `/api/yards/decide` | Explicit intent classification (used by tests/diagnostics) |
| `GET` | `/api/yards` | List registered yards + status |
| `POST` | `/api/yards/{id}/open` / `/close` | Manual yard control |
| `GET` | `/api/projects` | List projects |
| `POST` | `/api/projects` | Create project from template |
| `GET` | `/api/projects/{id}` | Project detail + file tree |
| `GET` / `PUT` | `/api/projects/{id}/files/{path}` | Read / write a file |
| `DELETE` | `/api/projects/{id}/files/{path}` | Delete a file |
| `GET` | `/api/research/search?q=` | Search (live + offline fallback) |
| `GET` | `/api/research/summarize?q=` | AI summary (can stream) |
| `GET` / `POST` | `/api/research/notes` | List / create notes |
| `DELETE` | `/api/research/notes/{id}` | Delete note |
| `POST` | `/api/system/type` | Type text (real or sim) |
| `POST` | `/api/system/move` | Move mouse (real or sim) |
| `POST` | `/api/system/click` | Click (real or sim) |
| `POST` | `/api/system/kill` | Abort all system actions (Esc handler too) |
| `POST` | `/api/settings/api-key` | Store Gemini key (masked, server-side only) |
| `GET` | `/api/settings` | Read settings (never the raw key) |
| `POST` | `/api/settings/model` | Select model variant |
| `POST` | `/api/settings/reset` | Wipe user data |
| `GET` | `/api/mcp/servers` | List registered tool providers (MCP-ready) |
| `POST` | `/api/mcp/execute` | Dispatch `{server, tool, args}` through providers |

### 3.6 Database schema (minimal, SQLite)

```sql
-- settings: key/value store (api_key, model, theme, ...)
CREATE TABLE settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- projects: one row per coding project
CREATE TABLE projects (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    template   TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- files: one row per file in a project
CREATE TABLE files (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    path       TEXT NOT NULL,
    content    TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (project_id, path)
);

-- conversations: chat history (messages stored as JSON)
CREATE TABLE conversations (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    messages   TEXT NOT NULL,          -- JSON array
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- notes: research yard notes
CREATE TABLE notes (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    text       TEXT NOT NULL,
    tags       TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

Implementation note: use stdlib `sqlite3`, `WAL` mode, repository-style helper functions in `db.py`. Zero external dependencies, survives venue machines.

### 3.7 State management

- **Zustand** stores (lightweight, zero boilerplate):
  - `appStore` — boot state, current view (home/yard/settings), settings, modal state.
  - `chatStore` — messages, streaming status, `send()` action that opens the SSE stream.
  - `yardStore` — active yard, open state, project list, current file, editor content.
- Server state (projects, notes, search results) fetched in effects via `lib/api.ts`. React Query only if time permits.
- SSE events update stores through a single `handleStreamEvent(event)` dispatcher — this is the integration point for all streaming UI.

### 3.8 UI component hierarchy

```
App
├─ BootScreen                      (full-screen, plays once)
├─ Shell
│  ├─ Sidebar                     Home | Yards | Plugins | Models | Settings
│  ├─ TopBar                      Orb dock, active yard, status, kill-switch
│  ├─ StatusBar
│  ├─ ViewHost
│  │  ├─ HomePage                 (orb centerpiece, quick commands)
│  │  ├─ YardsPage                (yard gallery)
│  │  └─ SettingsPage             (api key, model, reset)
│  ├─ YardShell                   (animated window)
│  │  ├─ YardTabs
│  │  ├─ CodingYard
│  │  │  ├─ ProjectList
│  │  │  ├─ FileExplorer
│  │  │  ├─ MonacoPane
│  │  │  └─ ConsolePanel
│  │  └─ ResearchYard
│  │     ├─ SearchPanel
│  │     ├─ SummaryPanel
│  │     └─ NotesPanel
│  └─ ControlMonitor              (overlay: keyboard/mouse visuals)
└─ ChatPanel (persistent, right)
   ├─ ChatMessage / StreamingText
   ├─ ThinkingIndicator
   └─ ChatInput
```

---

## 4. Project Structure

```
orion/
├─ README.md
├─ AGENTS.md                          # dev conventions + commands
├─ frontend/
│  ├─ index.html
│  ├─ package.json
│  ├─ vite.config.ts
│  ├─ tailwind.config.ts
│  ├─ tsconfig.json
│  ├─ public/
│  │  ├─ logo.svg
│  │  └─ fonts/                       # vendored (offline-safe)
│  └─ src/
│     ├─ main.tsx
│     ├─ App.tsx                      # boot gate → shell
│     ├─ styles/
│     │  ├─ globals.css               # tokens, dot-grid bg, glows
│     │  └─ orb.css
│     ├─ lib/
│     │  ├─ api.ts                    # fetch + SSE client
│     │  ├─ theme.ts
│     │  └─ utils.ts                  # cn(), clsx
│     ├─ state/
│     │  ├─ appStore.ts               # boot, current view, settings
│     │  ├─ chatStore.ts              # messages, streaming, send()
│     │  └─ yardStore.ts              # active yard, projects, files
│     ├─ components/
│     │  ├─ shell/
│     │  │  ├─ BootScreen.tsx         # INITIALIZING ORION
│     │  │  ├─ Sidebar.tsx            # Home/Yards/Plugins/Models/Settings
│     │  │  ├─ TopBar.tsx             # orb dock, status, kill-switch
│     │  │  ├─ StatusBar.tsx
│     │  │  └─ GlassModal.tsx
│     │  ├─ orb/
│     │  │  ├─ Orb.tsx                # state machine wrapper
│     │  │  ├─ OrbCanvas.tsx          # canvas particle system
│     │  │  └─ orbStates.ts           # idle/thinking/listening/executing
│     │  ├─ chat/
│     │  │  ├─ ChatPanel.tsx
│     │  │  ├─ ChatMessage.tsx        # markdown render
│     │  │  ├─ StreamingText.tsx      # typewriter
│     │  │  ├─ ChatInput.tsx
│     │  │  └─ ThinkingIndicator.tsx
│     │  ├─ yards/
│     │  │  ├─ YardShell.tsx          # window chrome + open/close
│     │  │  ├─ YardTabs.tsx
│     │  │  ├─ coding/
│     │  │  │  ├─ CodingYard.tsx
│     │  │  │  ├─ MonacoPane.tsx
│     │  │  │  ├─ FileExplorer.tsx
│     │  │  │  ├─ ProjectList.tsx
│     │  │  │  └─ ConsolePanel.tsx
│     │  │  └─ research/
│     │  │     ├─ ResearchYard.tsx
│     │  │     ├─ SearchPanel.tsx
│     │  │     ├─ SummaryPanel.tsx
│     │  │     └─ NotesPanel.tsx
│     │  ├─ control/
│     │  │  ├─ ControlMonitor.tsx     # live visualization of system actions
│     │  │  ├─ KeyboardVisual.tsx
│     │  │  └─ MouseVisual.tsx
│     │  └─ settings/
│     │     ├─ SettingsModal.tsx
│     │     ├─ ApiKeyForm.tsx
│     │     ├─ ModelSelect.tsx
│     │     └─ DangerZone.tsx         # reset data
│     └─ pages/
│        ├─ HomePage.tsx              # orb centerpiece
│        ├─ YardsPage.tsx             # yard gallery
│        └─ SettingsPage.tsx
├─ backend/
│  ├─ requirements.txt
│  ├─ run.py
│  └─ app/
│     ├─ main.py                      # FastAPI app, CORS, mounts
│     ├─ config.py
│     ├─ schemas.py                   # pydantic models
│     ├─ db.py                        # SQLite init + repositories
│     ├─ routers/
│     │  ├─ chat.py                   # SSE stream
│     │  ├─ yards.py
│     │  ├─ projects.py
│     │  ├─ research.py
│     │  ├─ system.py                 # computer control
│     │  ├─ settings.py
│     │  └─ mcp.py                    # tool registry endpoints
│     ├─ services/
│     │  ├─ gemini_client.py          # BYOK, streaming, JSON mode
│     │  ├─ orchestrator.py           # decide + route + tool loop
│     │  ├─ heuristic.py              # keyword classifier
│     │  ├─ prompts.py                # all prompts live here
│     │  ├─ tools/
│     │  │  ├─ base.py                # ToolProvider interface
│     │  │  ├─ system_tools.py        # pyautogui + sim
│     │  │  ├─ project_tools.py
│     │  │  ├─ search_tools.py
│     │  │  └─ notes_tools.py
│     │  ├─ mcp_adapter.py            # JSON-RPC-ish stub over providers
│     │  └─ computer_control.py       # pyautogui wrapper + kill switch
│     └─ data/
│        ├─ orion.db                  # runtime (gitignored)
│        └─ seed/
│           ├─ demo_project/          # pre-made to-do app template
│           ├─ research_docs.json     # offline search dataset
│           └─ canned_responses.json  # offline chat fallback
├─ scripts/
│  ├─ dev.ps1                         # runs backend + frontend
│  └─ offline_demo.ps1                # seeds data + disables live AI
└─ .gitignore
```

---

## 5. Implementation Order

Ordered by **dependency + demo value**. Each numbered block ends in a commit.

| # | Block | Hours | Why now |
|---|-------|-------|---------|
| 1 | Scaffold: Vite + React + TS + Tailwind + shadcn + crimson theme tokens | 1.5 | Everything sits on this |
| 2 | Shell layout: sidebar, top bar, chat panel skeleton, home area | 2 | Product shape appears |
| 3 | Orb: canvas particles + 4 states | 3 | The face — fail-fast on the riskiest visual |
| 4 | FastAPI skeleton: CORS, config, health, settings router, SQLite | 2 | Backend spine; wire BYOK early |
| 5 | BYOK Settings UI + Gemini streaming chat (SSE) | 3 | Proves the AI pipeline end-to-end |
| 6 | Yard system: YardShell, registry, spring open/close | 2.5 | The defining concept on screen |
| 7 | Auto yard switching: heuristic + Gemini decide + orchestration | 2.5 | The Magic Moment core |
| 8 | Coding Yard: templates, file explorer, Monaco, AI codegen, console | 5 | Biggest feature = biggest budget |
| 9 | Research Yard: search (live + offline), summary, notes | 3.5 | Second Yard, reuse patterns |
| 10 | Computer control: sim mode + real pyautogui + kill switch + visuals | 2.5 | The "does things" proof |
| 11 | Polish: boot screen, sounds, transitions, empty states, toasts | 3 | This is where demos win |
| 12 | Rehearsal + hardening: offline mode, seeds, preloads, README | 2 | Reliability |

**Total ≈ 32.5h** → deliberately over-budget by 2.5h; the cut list (Section 7) is where that slack is reclaimed when any block overruns.

---

## 6. Hour-by-Hour Timeline

`[BRK]` = 30-min break. Slack hours are marked; use them for polish, never for new features.

| Hour | Focus | Deliverable / exit criteria |
|------|-------|-----------------------------|
| **H1** | Scaffold | Repo init, `git init`, Vite+React+TS, Tailwind, shadcn init, crimson CSS tokens (black/white/crimson, dot-grid util, glow util). **Commit `chore: scaffold`** |
| **H2** | Shell layout | `Sidebar` (Home/Yards/Plugins/Models/Settings), `TopBar`, `StatusBar`, right `ChatPanel` skeleton, home area placeholder. **Commit `feat: shell`** |
| **H3** | Design polish | Card/button/tooltip primitives, glow + dot-grid styling, font setup, dark theme default — everything matches the mood board. |
| **H4** | Orb idle | `OrbCanvas` — ~120 dots on Lissajous paths, canvas DPR-aware, idle drift + breathing. **Commit `feat: orb idle`** |
| **H5** | Orb states | `orbStates.ts` + `Orb.tsx` state machine. Thinking (collapse→fast orbit+pulse), Listening (expanding rings), Executing (directional beams). Framer Motion springs on wrapper; canvas lerp inside. **Commit `feat: orb states`** |
| **H6** | Boot screen | `BootScreen` — logo, dot sweep, `INITIALIZING ORION`, enters shell; fullscreen kiosk hint (F11). |
| **H7** | Backend skeleton | FastAPI app, CORS for `localhost:5173`, `/api/health`, settings router, SQLite init (`db.py`), JSON+pydantic everywhere. **Commit `feat: backend skeleton`** |
| **H8** | BYOK settings | `SettingsPage` + `ApiKeyForm` + `ModelSelect`. Key stored server-side in SQLite, never exposed back to the client (masked). **[BRK] before H9** |
| **H9** | Gemini streaming | `gemini_client.py` (httpx async, stream, JSON mode), `POST /api/chat/stream` (SSE). Test with curl. |
| **H10** | Chat panel live | `ChatMessage`, `StreamingText`, `ThinkingIndicator`, stop button, markdown render. |
| **H11** | Chat polish | Error toasts, retry, persistence of last session, message timestamps. **Commit `feat: streaming chat`** |
| **H12** | Yard system | `YardShell` window chrome, `YardTabs`, registry (`{id, name, icon, component}`), spring open/close animation, orb docks into top bar. |
| **H13** | Auto switching | `heuristic.py` keyword classifier + Gemini decide call (JSON mode) + `orchestrator.py`. `/api/chat/stream` now emits `yard.open` events. Frontend listens and animates. **Commit `feat: auto yard switching`** |
| **H14** | Coding: projects | `ProjectList`, create-project flow, template loader (`seed/demo_project`), `ProjectTools` provider. |
| **H15** | Coding: Monaco | `MonacoPane` lazy-loaded, crimson theme, open/switch files via FileExplorer. |
| **H16** | Coding: files | `FileExplorer` tree — create/rename/delete, dirty indicator, keyboard shortcut awareness. **[BRK] before H17** |
| **H17** | Coding: AI codegen | "build me X" → AI creates files via `ProjectTools`; generated code lands in Monaco; streaming reasoning in chat. |
| **H18** | Coding polish | Split-pane drag, `ConsolePanel` (simulated `npm run dev` output), status bar shows project. **Commit `feat: coding yard`** |
| **H19** | Research: layout | `ResearchYard` three-pane layout: Search | Summary | Notes. |
| **H20** | Research: search | `SearchTools` — live search attempt (DuckDuckGo/SearXNG or Gemini grounded) + **offline dataset fallback** (`research_docs.json`). |
| **H21** | Research: AI + notes | `SummaryPanel` (Gemini summarize), `NotesPanel` (persist to SQLite via `NotesTools`). **Commit `feat: research yard`** |
| **H22** | Computer control | `computer_control.py` — pyautogui wrapper (type/click/move), simulation mode, Esc kill-switch, `POST /api/system/...`. |
| **H23** | Control visuals | `ControlMonitor` + `KeyboardVisual` + `MouseVisual` — a translucent overlay in the shell showing every action the AI performs. **Commit `feat: computer control`** |
| **H24** | Polish pass 1 | Transitions everywhere, empty states, toasts, focus rings, sidebar active dots. **[BRK]** |
| **H25** | Sound + micro | Subtle sounds (open, think, done) via WebAudio (no asset files needed), orb state cross-fades. |
| **H26** | Settings final | Full settings modal polish, reset-data button, model picker working, keyboard shortcuts (Esc closes yards, Ctrl+K focus chat). |
| **H27** | Rehearsal | Run the full 4-min demo **3×**, fix every bug found. Record a backup video. |
| **H28** | Hardening | Offline mode toggle (uses `canned_responses.json` + seeds), preload Monaco/fonts, verify zero network deps for core flow. |
| **H29** | README + docs | README structure, screenshot pass, final polish commit. |
| **H30** | Buffer / contingency | Whatever remains: extra rehearsal, fix anything that breaks on the demo machine, ensure a clean checkout runs with `dev.ps1`. |

---

## 7. Development Checklist

### Must Have (cut these → fail)

- [ ] Crimson design system (dot grid, glows, typography)
- [ ] Boot screen
- [ ] Orb with 4 states: Idle / Thinking / Listening / Executing
- [ ] Left sidebar: Home / Yards / Plugins / Models / Settings
- [ ] Persistent right AI chat with **streaming**
- [ ] BYOK Gemini (settings page, stored server-side)
- [ ] Yard system: at least Coding + Research, animated open/close
- [ ] **Automatic Yard switching** from chat (heuristic + Gemini)
- [ ] Coding Yard: Monaco + FileExplorer + AI codegen + project templates
- [ ] Research Yard: search + AI summary + notes
- [ ] Computer control: mouse/keyboard (sim mode + real), kill switch
- [ ] MCP-shaped tool layer visible in code + one endpoint
- [ ] Offline demo mode + seeded data
- [ ] `dev.ps1` one-command boot

### Should Have (strongly recommended)

- [ ] Listening state via Web Speech API (feature-detect; hide if unavailable)
- [ ] Console panel in Coding Yard (simulated output)
- [ ] Sound design (WebAudio, procedural)
- [ ] ControlMonitor overlay visualizing AI system actions
- [ ] Session persistence (SQLite conversations)
- [ ] Model selector (Gemini variants)
- [ ] Keyboard shortcuts

### Nice To Have (only if ahead)

- [ ] xterm.js terminal in Coding Yard (real shell, or simulated)
- [ ] Third Yard (e.g., "Design" or "Data") for the gallery page
- [ ] Voice synthesis (spoken responses)
- [ ] Tauri desktop wrapper
- [ ] Real MCP server (JSON-RPC over stdio)

### Cut Immediately (do not touch)

- [x] Authentication / accounts
- [x] Cloud sync / deployment
- [x] Plugin marketplace / many providers
- [x] Complex memory / long-term personalization
- [x] Production security hardening
- [x] Mobile / responsiveness
- [x] Testing beyond the demo script
- [x] Tauri as a dependency

---

## 8. Demo Script

**Total: ~4 minutes.** One machine, one browser, window maximized. Speaker explains in 1 line between beats. **Rehearsed 5×.**

| Time | Screen | Narration (≤1 line) |
|------|--------|----------------------|
| 0:00 | Black → Orion logo → boot dots | "This is Orion — the open-source AI operating system." |
| 0:10 | Home screen, orb **Idle** | "It's not a chatbot. It's an OS that shapes itself around what you ask." |
| 0:20 | Walk sidebar (Hover each: Home/Yards/Plugins/Models/Settings) | "System navigation, plugins, models — everything you'd expect from an OS." |
| 0:35 | Right chat panel opens | "And a persistent AI, everywhere, always." |
| 0:50 | Type: *"Open the coding yard and build me a to-do app."* | "Watch what happens when you give it a real task." |
| 1:00 | Orb → **Thinking** → **Coding Yard springs open** | "It decided the intent, opened the right workspace itself." |
| 1:15 | AI streams reasoning; creates files in FileExplorer; code appears in Monaco | "No chat wall. Files, editor, console — the AI works in the workspace." |
| 1:45 | Ask: *"Add dark mode to the app."* — code diff appears in Monaco | "And it keeps working with full context of the project." |
| 2:15 | Close coding yard. Type: *"Research quantum computing."* | "Same conversation, completely different workspace." |
| 2:30 | **Research Yard** opens; search results stream; summary panel fills | "Live search, AI summary — a research OS in one panel." |
| 2:50 | Type: *"Open Notepad and type our team name."* | "And because it's an OS, it can act on the machine itself." |
| 3:00 | **ControlMonitor** overlay shows typing + mouse movement; Notepad types | "Real mouse, real keyboard — with a kill switch if it ever goes wrong." |
| 3:25 | Show Plugins/Models pages quickly | "And it's built MCP-ready — every capability is a pluggable tool." |
| 3:40 | Close | "Orion. The open-source AI operating system." |

**Contingency beats (know them cold):**

- If network fails: "Watch the same flow in offline mode" → toggle, uses seeded data (identical UI).
- If Gemini key is missing at demo: key is preloaded in the demo machine's SQLite; show Settings masked key.
- If a Yard fails to open: the heuristic classifier still opens it; or manually click the Yard tab and say "the orchestrator's fallback."

---

## 9. Judge Q&A Preparation

**Q: "What makes this different from every other AI assistant?"**
A: "Every assistant answers in a chat box. Orion treats the machine as the interface — it opens a dedicated workspace per task and acts inside it: writes files, runs searches, controls the OS. Chat is just one panel of an operating system."

**Q: "How does automatic Yard switching work?"**
A: "Two layers. A synchronous keyword heuristic gives an instant signal, then the model classifies intent as structured JSON — `{yard, action, confidence}`. The orchestrator merges both: heuristic is the safety net, Gemini is the intelligence. If they conflict, Gemini wins above a confidence threshold."

**Q: "Where's MCP?"**
A: "Under the hood, every capability is a `ToolProvider` — `list_tools()` and `execute()`. Search, files, notes, and system control are all providers behind one registry, exposed via `/api/mcp/execute`. A real MCP server plugs into that same seam without touching the yards." *(Point to `tools/base.py` and `mcp_adapter.py`.)*

**Q: "How do you keep the AI from doing dangerous things?"**
A: "System actions require confirmation, every action streams to a visible ControlMonitor overlay, and Esc is a global kill switch. In simulation mode nothing touches the real machine."

**Q: "What's the tech stack?"**
A: "React + TypeScript + Tailwind + Framer Motion frontend; FastAPI backend; Gemini for the model with your own key; Monaco for editing; SQLite for state; pyautogui for system control."

**Q: "Is this actually an OS?"**
A: "It's an OS *experience* and an OS *architecture* — a shell that routes intents to task-shaped workspaces, with system-level tool access. We built the environment rather than another bot."

**Q: "How would you scale the Yard concept?"**
A: "Yards are a registry, not a switch statement. Add a Yard = register an entry with a component and a tool provider. The marketplace of the future ships Yards as plugins."

**Q: "Why BYOK / why Gemini?"**
A: "BYOK means judges can try it with their own key — no shared-rate-limit crashes at demo time. Gemini's structured JSON output makes intent classification deterministic, which is exactly what a reliable OS needs."

**Q: "What was hardest?"**
A: "Reliability — the AI layer is probabilistic, but an operating system must feel deterministic. The answer was the two-layer intent system and simulation modes so the demo never depends on a single API call."

**Q: "What did you cut and why?"**
A: "Auth, cloud sync, and a real desktop shell — none of them are visible in a demo. We spent that time on the orb, the Yard animations, and rehearsing the exact flow."

---

## 10. Future Roadmap

**Post-hackathon (in order of value):**

1. **Real MCP server** — JSON-RPC over stdio so Orion speaks the universal tool protocol.
2. **Yard plugin marketplace** — Yards-as-plugins; the registry already supports it.
3. **More Yards** — Data, Design, Email, Terminal — each a component + tool provider.
4. **Real voice loop** — STT + TTS for a Jarvis-grade interface.
5. **Tauri desktop shell** — the OS illusion becomes a real desktop app with global hotkeys.
6. **Real memory** — cross-session project context, retrieval on notes.
7. **Multi-model routing** — per-Yard model selection (coding = reasoning model, research = grounded model).
8. **Cloud sync** — settings/keys and Yard layouts across machines (only after everything else).

---

*End of SPEC. Next step: execute H1–H2 sprint (scaffold + shell).*
