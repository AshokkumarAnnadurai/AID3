# Offline AI Meeting Assistant — Offline Setup Guide & Model Licenses

## 1. Quick Start Guide

### Step 1: Clone and Install Dependencies
```bash
git clone <repo-url>
cd offline-ai-meeting-assistant
npm install
```

### Step 2: Run Full Automated Verification Suite
Execute all 5 phases of tests covering SQLite migrations, local audio capture, Whisper STT, Llama-3.2 LLM, hierarchical rollup, bidirectional evidence linking, SQLCipher encryption, and crash recovery:
```bash
npm test
```

### Step 3: Start the Development Server
```bash
npm run dev
```

---

## 2. On-Device Model Weights & Licenses

The Offline AI Meeting Assistant utilizes open-weight models optimized for consumer edge devices:

| Component | Model Name | Format / Quantization | Size | License |
|---|---|---|---|---|
| **Speech-to-Text (STT)** | OpenAI Whisper `tiny.en` | GGML / Q5_1 | ~31 MB | MIT License |
| **Language Model (LLM)** | Meta Llama-3.2 1B Instruct | GGUF / Q4_K_M | ~700 MB | Llama 3.2 Community License |

### Model Storage Directory
Models are placed in the application's offline asset directory:
- Android: `android/app/src/main/assets/models/`
- iOS: `ios/Resources/models/`
- Web / Simulator: In-memory virtualized runtime with cached binary ArrayBuffers.

---

## 3. Air-Gapped Verification Protocol

To verify zero network communication:
1. Turn on **Airplane Mode** on your physical mobile device.
2. Turn off **Wi-Fi** and **Cellular Data**.
3. Launch the application.
4. Record audio from the **Record** tab.
5. In the meeting detail screen, run **Transcribe Audio** and **Generate MOM**.
6. Export the resulting minutes to **Markdown** or **HTML / PDF**.
7. Navigate to **Settings** -> **Zero-Cloud Air-Gapped Audit** -> verify `0 Active Sockets` and `0 Outbound Requests`.
