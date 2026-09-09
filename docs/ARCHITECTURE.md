# 🏛️ Architecture & Clean Code Blueprint

**Project:** Nexara — Digital Library & Living Forest System  
**Framework:** React 19 + TypeScript + Vite + Express (Full-Stack CJS Bundle)  
**Styling Engine:** Tailwind CSS v4  
**State Architecture:** Zustand (with local persistence & Supabase cloud sync)  

---

## 🏗️ 1. Clean Architecture Layering

The codebase is organized adhering to **Clean Architecture** principles, maintaining a strict separation of concerns across four foundational layers:

```
┌─────────────────────────────────────────────────────────────┐
│                 1. PRESENTATION LAYER (UI)                  │
│   src/components/{library, forest, reader, discovery, ...}   │
└──────────────────────────────┬──────────────────────────────┘
                               │ uses
┌──────────────────────────────▼──────────────────────────────┐
│                 2. APPLICATION / STATE LAYER                │
│             src/stores/ (Zustand State Engines)             │
└──────────────────────────────┬──────────────────────────────┘
                               │ consumes
┌──────────────────────────────▼──────────────────────────────┐
│                   3. DOMAIN & DATA LAYER                    │
│   src/types/ (Entities) | src/data/ (Curated Manuscripts)   │
└──────────────────────────────┬──────────────────────────────┘
                               │ implements
┌──────────────────────────────▼──────────────────────────────┐
│               4. INFRASTRUCTURE & LIB LAYER                 │
│   server.ts | src/lib/ (Audio, Download, Search, Supabase)  │
└─────────────────────────────────────────────────────────────┘
```

---

## 📂 2. Directory Structure & Functional Taxonomy

```
nexara/
├── server.ts                       # Backend Server Entrypoint (Express + Vite Middleware)
├── vite.config.ts                  # Vite Bundler & Tailwind v4 Plugin Configuration
├── package.json                    # Full-Stack Dependencies & Production Build Scripts
├── metadata.json                   # Applet Capabilities & Platform Metadata
│
├── docs/                           # 📚 Architecture & System Documentation
│   ├── API.md                      # REST APIs & Cloud Sync Specifications
│   └── ARCHITECTURE.md             # Clean Architecture & Code Blueprint
│
└── src/
    ├── main.tsx                    # React Root Entrypoint & Global DOM Mount
    ├── App.tsx                     # Top-Level Layout Orchestrator & View Switcher
    ├── index.css                   # Global Tailwind CSS Imports & Display Fonts
    │
    ├── types/                      # 📐 Domain Layer: Type Definitions & Entities
    │   └── index.ts                # Books, Authors, Rights, Forest Regions, Audio, Rituals
    │
    ├── config/                     # ⚙️ Brand & Forest Constants
    │   └── brand.ts                # Palette tokens, forest coordinates, typography schemes
    │
    ├── data/                       # 📖 Seed & Curated Literary Corpus
    │   ├── books.ts                # Master collection of bilingual classic manuscripts
    │   └── authors.ts              # Historical biographer metadata & eras
    │
    ├── i18n/                       # 🌐 Internationalization Layer
    │   └── translations.ts         # Complete English & Arabic translation dictionaries
    │
    ├── lib/                        # 🛠️ Infrastructure & Utility Engines
    │   ├── audioEngine.ts          # Web Audio API Synthesizer (Nature & Meditation)
    │   ├── downloadEngine.ts       # Client-side PDF/EPUB/TXT Exporter & Reader Ingest
    │   ├── onlineBookSearch.ts     # Open Library & Public Domain Metadata Fetcher
    │   ├── recommendations.ts      # Multi-dimensional heuristic literary matching
    │   ├── searchEngine.ts         # High-speed multi-facet in-memory search
    │   └── supabase.ts             # Supabase Client Initialization & Remote Schema
    │
    ├── stores/                     # 🧠 Application State Layer (Zustand)
    │   └── useAppStore.ts          # Central reactive store with LocalStorage persistence
    │
    └── components/                 # 🎨 Presentation Layer: Modular Components
        ├── navigation/             # Top Navbar, Command Palette, Audio Quick Controls
        ├── library/                # Grid, Shelf, List views, Filters, Search Bars
        ├── forest/                 # Procedural Tree Physics, Weather Engine, Memory Grove
        ├── reader/                 # Fullscreen Reading Canvas, Typography & Margin Sliders
        ├── discovery/              # Online Book Search & Gutenberg Downloader Modal
        ├── author/                 # Biographer Detail Modal & Related Works
        ├── quotes/                 # Literary Quote Card Studio & Visual Exporter
        ├── rituals/                # Reading Streak, Focus Timer, Journaling
        ├── personal/               # User Bookmarks, Notes, and Time Capsules
        ├── community/              # Shared Reflections & Social Discussion Feeds
        ├── auth/                   # Supabase Authentication & Profile Modal
        ├── admin/                  # Content Administration & Ingestion
        └── ui/                     # Reusable Atomic Elements (Buttons, Modals, Badges)
```

---

## ⚡ 3. Key Design Principles Followed

1. **Single Responsibility Principle (SRP)**:
   - Components are modularized by domain (e.g. `CinematicForestCanvas` handles only canvas rendering, `MemoryGrove` handles user reflections, `ReadingEngine` handles page turns and typography).
2. **Immutable & Predictable State**:
   - `useAppStore.ts` centralizes user actions with immutable updates and automatic synchronization to `localStorage`.
3. **Hardware-Accelerated Rendering**:
   - Canvas animations use `requestAnimationFrame` with passive event listeners and `IntersectionObserver` pause hooks to guarantee 60 FPS performance without memory leaks.
4. **Offline-First & Fault Tolerance**:
   - Even without an internet connection or Supabase credentials, the application operates deterministically with zero UI crashes.
