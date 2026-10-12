# Offline AI Meeting Assistant — Architecture Documentation

## 1. High-Level System Overview

The Offline AI Meeting Assistant is a fully local, zero-cloud mobile application built for Android and iOS using React Native, Expo development builds, and native C++ runtimes (`whisper.cpp` and `llama.cpp`). It operates under strict zero-network privacy: all audio capture, speech transcription, local LLM inference, minute generation, and SQLite persistence execute entirely on-device.

```
+---------------------------------------------------------------------------------------+
|                                    PRESENTATION LAYER                                 |
|   Expo Router / React Native Components  (Orange-500 Theme Accent, Dark/Light Mode)   |
|   Screens: Dashboard  |  Meetings  |  Live Recorder  |  Meeting Details  |  Settings   |
+---------------------------------------------------------------------------------------+
                                           |
                                           v
+---------------------------------------------------------------------------------------+
|                                      STATE LAYER                                      |
|                       Redux Toolkit + React Hook Form + Zod                           |
|       Slices: meetingsSlice | recorderSlice | jobsSlice | modelsSlice | settingsSlice |
+---------------------------------------------------------------------------------------+
                                           |
                                           v
+---------------------------------------------------------------------------------------+
|                                     SERVICE LAYER                                     |
|  +------------------------+  +------------------------+  +--------------------------+ |
|  |  AudioRecorderService  |  |   ProcessingQueue      |  |  ModelRegistryService    | |
|  |  (Permissions, Waveform|  |   (Job state machine,  |  |  (GGUF integrity check,  | |
|  |   Interruption handler)|  |    worker isolation)   |  |   RAM/Thermal guards)    | |
|  +------------------------+  +------------------------+  +--------------------------+ |
+---------------------------------------------------------------------------------------+
            |                              |                             |
            v                              v                             v
+------------------------+    +--------------------------+  +--------------------------+
|  Native Audio Engine   |    |  Local Transcription     |  |  Local LLM Runtime       |
|  - Android AudioRecord |    |  - whisper.cpp C++ bridge|  |  - llama.cpp C++ bridge  |
|  - iOS AVAudioEngine   |    |  - ggml-metal / NNAPI    |  |  - GGUF Quantized (Q4_K) |
|  - 16kHz 16-bit Mono   |    |  - Background Worker Thd |  |  - Isolated native thread|
+------------------------+    +--------------------------+  +--------------------------+
                                           |
                                           v
+---------------------------------------------------------------------------------------+
|                                    DATA STORAGE LAYER                                 |
|                    SQLite Embedded Database (Transactions & WAL Mode)                 |
|             Versioned Migration Engine (schema_migrations tracking table)             |
|       Repositories: Meetings, Segments, Actions, Decisions, Jobs, Artifacts           |
+---------------------------------------------------------------------------------------+
```

---

## 2. Core Architectural Principles

1. **Zero-Cloud & Zero-Network Dependency**
   No external API requests, telemetries, or authentication servers. All tokens, transcripts, and model weights remain inside the sandboxed app storage.

2. **JavaScript Thread Protection**
   Heavy AI inference (Whisper STT matrix multiplications and Llama token generation) must **never** run on the React Native JS thread. They execute inside native background C++ worker threads with progress event callbacks emitted via React Native bridges.

3. **State Authoritative SQLite**
   The database is the single source of truth. The Redux store mirrors SQLite states and provides optimistic, responsive UI interactions with error rollbacks.

4. **Crash & Interruption Resilience**
   Audio recordings are flushed to disk periodically in chunks so an OS kill or low-battery event does not corrupt prior minutes. The processing queue persists jobs and resumes pending steps upon app restart.

---

## 3. Technology Stack Breakdown

| Layer | Technology | Rationale |
|---|---|---|
| **Framework** | Expo SDK (Custom Dev Client) | Fast iteration with native module support via config plugins |
| **Language** | TypeScript (Strict Mode) | Zero implicit any, compile-time safety across complex AI schemas |
| **Routing** | Expo Router | File-based navigation matching native platform navigation stacks |
| **State Management** | Redux Toolkit | Predictable slice architecture, immutable updates, and serialization |
| **Forms & Validation** | React Hook Form + Zod | Low re-renders, strongly typed meeting schemas and LLM JSON parsing |
| **Local Storage** | SQLite (`expo-sqlite` / SQLite3) | Full relational ACID capabilities, foreign keys, and FTS5 search |
| **Speech-to-Text** | `whisper.cpp` (GGML format) | Ultra-compact (Whisper Base/Small quantized to 75MB–150MB), CPU/GPU accelerated |
| **Local LLM** | `llama.cpp` (GGUF format) | High-performance inference for 1B–3B parameter models (e.g., Llama-3.2-1B-Instruct, Qwen2.5-1.5B) |

---

## 4. Native Bridge & Model Runtime Strategy

### A. Whisper.cpp Native Integration
- **Input:** 16,000 Hz, 16-bit Mono WAV or PCM buffer.
- **Quantization:** `ggml-tiny.en-q5_1.bin` (~31MB) or `ggml-base.en-q5_1.bin` (~57MB).
- **Execution:** Runs in a native pthread. Emits segment callbacks `{ startMs, endMs, text, confidence }` into the JS runtime.

### B. Llama.cpp Native Integration
- **Model Target:** `Llama-3.2-1B-Instruct-Q4_K_M.gguf` (~700MB) or `Qwen2.5-1.5B-Instruct-Q4_K_M.gguf` (~980MB).
- **Context Window:** 4,096 tokens with chunked rollup for long meetings.
- **Structured Extraction:** Constrained generation using JSON grammar files (`grammar.gbnf`) to enforce strict JSON schemas matching Zod contracts.

---

## 5. Directory Structure Mapping

```
src/
├── features/
│   ├── dashboard/       # Overview metrics, recent meetings, device health
│   ├── meetings/        # Meeting history, filters, details, CRUD
│   ├── recorder/        # Audio recording, waveform visualizer, background service
│   ├── transcript/      # Interactive timestamped transcript, playback, segment editing
│   ├── minutes/         # Executive summary, key discussion points, decisions
│   ├── actions/         # Action item tracker, owners, deadlines, priority, status
│   └── settings/        # Model management, storage management, hardware specs
├── components/          # Reusable UI component system (Button, Card, Badge, Modal, etc.)
├── services/            # Audio recorder, STT, LLM, Database, Queue abstractions
│   ├── audio/           # Audio capture and playback service
│   ├── database/        # SQLite connection, repositories, migration runner
│   ├── queue/           # Background job scheduler and state machine
│   ├── stt/             # Whisper STT engine interface and implementations
│   ├── llm/             # Llama LLM runtime interface and implementations
│   └── types/           # Service contracts and domain models
├── store/               # Redux Toolkit store, typed hooks, feature slices
├── theme/               # Orange-500 accent system, dark/light palette, typography
└── utils/               # Time formatting, file utilities, validation helpers
```
