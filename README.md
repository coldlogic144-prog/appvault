# ComicLink

ComicLink is a cross-device file-sharing, clipboard synchronization, and community communication platform styled with an energetic comic-book and manga visual aesthetic. Designed for creators, readers, and power users, ComicLink bridges desktop and mobile workflows with seamless device pairing, comic-panel messaging, and robust cloud storage.

The platform combines an Electron desktop application (React 18, Vite, TypeScript, and Tailwind CSS) with a serverless Google Firebase backend (Firebase Auth, Cloud Firestore, Cloud Storage, and Cloud Functions). It enforces multi-process isolation in Electron and strict defense-in-depth security rules across all backend services.

---

## Current Status

> [!NOTE]
> **Current Milestone: Phase 0 (Foundation)**  
> The project is currently in the initial foundation phase. The monorepo workspace structure, architectural specifications, database schemas, security models, and developer scripts are in place. Core application features (Auth, Pairing, Transfer, Chat) are scheduled across Phases 1 through 7 as outlined in the roadmap below.

---

## Tech Stack Summary

- **Desktop Shell**: Electron (isolated main, preload bridge, sandboxed renderer)
- **Frontend Framework**: React 18 with TypeScript
- **Bundler & Dev Server**: Vite with Hot Module Replacement (HMR)
- **Styling**: Tailwind CSS with custom comic-themed styling (halftone patterns, ink borders, speech bubbles)
- **Backend & Cloud Services**: Google Firebase (Auth, Cloud Firestore, Cloud Storage, Cloud Functions v2)
- **Data Validation**: Zod (isomorphic runtime validation)
- **Monorepo Management**: npm workspaces
- **Testing**: Vitest

---

## Prerequisites

Ensure the following dependencies are installed on your host system:

- **Node.js**: `v20.0.0` or higher
- **npm**: `v10.0.0` or higher
- **Firebase CLI**: `npm install -g firebase-tools`
- **Java Runtime Environment (JRE)**: Java 17+ (required by the Firebase Local Emulator Suite)

---

## Quick Start

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/your-org/comiclink.git
cd comiclink

# On Windows PowerShell (if execution policy is restricted, use cmd /c):
cmd /c npm install
```

### 2. Environment Configuration
Copy the sample environment file and configure your local or Firebase project variables:
```bash
copy .env.example .env
```
For local development against emulators, the defaults in `.env.example` (`VITE_USE_EMULATORS=true`) work out of the box.

### 3. Start the Firebase Emulator Suite
Open a terminal and start the emulators:
```cmd
scripts\emulators.cmd
```
*Or via npm:*
```bash
npm run emulators
```
This boots local emulators for Auth (`9099`), Firestore (`8080`), Storage (`9199`), and Functions (`5001`).

### 4. Start the Development Environment
In a separate terminal, launch Vite and Electron concurrently:
```cmd
scripts\dev.cmd
```
*Or via npm:*
```bash
npm run dev
```

---

## Project Structure

```
d:\web\ComicLink\
├── apps/
│   └── windows/              # Electron desktop application (Main, Preload, Renderer)
├── backend/
│   ├── firestore/            # firestore.rules and firestore.indexes.json
│   ├── functions/            # Cloud Functions (TypeScript / Node 20)
│   └── storage/              # storage.rules
├── docs/
│   ├── architecture.md       # High-level system architecture & data flows
│   ├── database-schema.md    # Specification of all 15 Firestore collections
│   └── security-model.md     # Multi-layered authorization & threat mitigations
├── packages/
│   ├── constants/            # Global timeouts, limits, collection paths
│   ├── error-codes/          # Unified domain and API error codes
│   ├── shared-types/         # TypeScript interfaces for database documents & DTOs
│   └── validation/           # Shared Zod schemas for runtime validation
├── scripts/
│   ├── dev.cmd               # Concurrently starts Vite & Electron
│   └── emulators.cmd         # Launches Firebase Emulator Suite
├── .env.example              # Sample client environment variables
├── package.json              # Monorepo root package definition
└── tsconfig.base.json        # Base TypeScript compiler configuration
```

---

## Development Phases Roadmap

| Phase | Title | Scope & Objectives | Status |
| :---: | :--- | :--- | :---: |
| **0** | **Foundation & Tooling** | Monorepo setup, TypeScript base, docs, schema, and dev scripts | **Completed** |
| **1** | **Auth & Device Pairing** | Firebase Auth integration, device registration, 6-digit code handshake | Planned |
| **2** | **File Transfer & Storage** | Direct file upload/download, SHA-256 validation, Cloud Storage rules | Planned |
| **3** | **Clipboard Synchronization** | OS-level clipboard monitoring, encrypted sync, history pane | Planned |
| **4** | **Comic Messaging** | 1-on-1 and self-sync chat, speech bubble layouts, action sounds | Planned |
| **5** | **Community Feed & Social** | Multi-panel comic posts, comments, likes, report submission workflow | Planned |
| **6** | **Native Windows Integration** | System tray, global shortcuts, native notifications, frameless UI | Planned |
| **7** | **Hardening & App Check** | Firebase App Check attestation, end-to-end encryption, production builds | Planned |

---

## Documentation

Comprehensive technical documentation is located in the `/docs` directory:
- [Architecture Specification](docs/architecture.md): Deep-dive into process boundaries, IPC bridge, security tiers, and data flows.
- [Database Schema](docs/database-schema.md): Complete specifications for all 15 Firestore collections, indexes, and retention rules.
- [Security Model & Threat Matrix](docs/security-model.md): Detailed analysis of identity, ownership, immutability, and attack mitigations.

---

## Contributing

1. All code must pass type-checking across all monorepo workspaces:
   ```bash
   npm run typecheck
   ```
2. Lint rules must be respected:
   ```bash
   npm run lint
   ```
3. Never commit `.env` or Firebase service account keys to source control.
4. Always test rule and schema changes against the Firebase Emulator suite before opening a pull request.

---

## License

This project is licensed under the terms of the MIT License. See [LICENSE](LICENSE) for details (placeholder).
