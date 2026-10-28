# Personal AI — project doc

**What it is:** Randhir's own desktop voice assistant for personal use — an
original implementation of the Friday-style feature set (wake word, face
unlock, voice commands, chat brain, vision, automations), extended with a
tool-calling core, a personal notes search ("ask my notes"), long-term
memory, a cost dashboard, a web version, and a mobile companion app.

**Repo:** https://github.com/randhirsingh77/personal-ai — **PRIVATE**
(verified through the API after creation: `"private": true`).
Local clone: `~/workspace/personal-ai`.

**Originality note:** everything was written fresh for this project. The
Friday project uploaded earlier was used only as a feature reference —
none of its code, face data, trained model, cookies, or contacts were
opened, copied, or reused. The contacts list ships empty; face data is
captured from Randhir, on his PC, only when he runs the setup.

---

## How it is put together (plain language)

The assistant is a Python program (`engine/`) with a React screen
(`frontend/`, built into `www/`). Two processes start together from
`run.py`: the assistant itself, and a small wake-word listener that taps
the assistant on the shoulder when it hears the wake phrase.

### The tool-calling core (the big idea)

Every ability — weather, jokes, Wikipedia, WhatsApp, camera, notes,
memory — is registered as a **tool**: a name, a plain-English
description, a strict list of allowed inputs (a "schema"), the function
that does the work, and a flag saying whether it is *destructive*
(sends or deletes something).

When Randhir says something, a **planner** turns the words into tool
calls. Today the planner is a set of intent patterns (no AI key needed).
An **executor** then checks the inputs against the schema, and if a
tool is destructive it **stops and asks for confirmation** ("WhatsApp
Asha saying I'll be late — yes or no?") before anything runs. Every
call is written to a **traces** log with its timing, which is what the
Stats screen reads.

Why this shape matters: later, the pattern planner can be swapped for
Gemini's function-calling (or a local model) **without touching a
single tool** — the tools are the stable contract. This is the design
used by professional agent products, and it is the strongest thing in
the project to talk about.

### Ask my notes (personal RAG)

Documents dropped into the `notes/` folder (`.md`, `.txt`, `.pdf`) are
chopped into ~600-character pieces, turned into number-vectors by a
small local model (all-MiniLM-L6-v2), and stored in a local Chroma
database. "Ask my notes about normalisation" finds the closest pieces
and answers **with the file name and chunk quoted**, so any answer can
be checked. With no chat key, the answer is the passages themselves
(labelled "extractive") — the assistant never pretends a summary it
didn't make. If the embedding model hasn't downloaded yet, a built-in
word-based fallback embedder keeps the feature working (Settings shows
which one is active).

### Memory

"Remember that my exam is on Friday", "I prefer tea" — statements like
these are stored with a vector each. Before saving a new one, the
assistant compares it with what it already has: a near-duplicate
**updates** the old entry (or is ignored as a NOOP) instead of piling
up copies — the same ADD/UPDATE/NOOP idea products like Mem0 use.
Relevant memories are quietly added to chat context, and the Memory
screen lists everything, editable and deletable. Nothing is remembered
invisibly.

### Chat brains

Three providers, tried in order (setting `LLM_PROVIDER` in `.env`):
**Gemini** (needs the free key) → **Ollama** (a model running locally
on the PC — fully offline once installed) → **Hugging Face** (optional
token). With none available, chat replies with clear setup instructions
while every built-in command keeps working.

### Cost dashboard (Stats screen)

Reads the traces log: tool calls, chat turns, estimated tokens, and a
**"would-have-cost" in rupees** — what the same usage would cost at the
providers' published *paid* rates, converted at a USD→INR rate stored
in config (₹95.14, the rate on 26 Oct 2026, editable in `.env`). Real
spend on the free tiers is ₹0 and the screen says so. It is an honest
estimate, labelled as one.

### Face unlock, wake word, and never locking the owner out

`setup_face.py` captures the owner's face samples with the webcam and
trains an OpenCV LBPH model — samples and model live in `data/`
(git-ignored) and ship nowhere. At startup the assistant checks the
face before unlocking. If no model exists yet, it *says so* and falls
back to a PIN (`OWNER_PIN` in `.env`). The wake word uses Porcupine
when its key is present; without it, the mic button and typing work.

### The web version

`python -m server_api` starts a small FastAPI service with the **same**
tools/planner/chat/notes/memory/stats over HTTP. The React UI's bridge
layer has three interchangeable transports — eel (desktop), HTTP (web),
and a demo mock (plain browser development) — so the same screens work
everywhere. The API binds to **localhost only** unless
`PAI_API_ALLOW_LAN=1` is set, and every call needs a **pairing token**
the desktop app generates and shows in Settings. The token is never
printed in logs.

### The mobile app

An Expo + React Native + TypeScript app in `mobile/` — the same stack
Randhir already works in. It pairs once with the PC's address + token
(saved on the phone), then offers Chat (typed commands; dictation via
the keyboard mic; replies spoken aloud), Stats, and Memory. It is
honestly a *remote*: face unlock, wake word, and PC/phone automation
stay on the desktop, and the app says so instead of faking them.

---

## How it was verified (sandbox, headless)

- **Smoke suite `tests/smoke_test.py`: 45/45 checks pass** — all module
  imports; 25 router intents; the tool registry (34 tools, all typed,
  destructive ones flagged); planner dry-runs incl. a 2-step command;
  the confirmation gate (blocked unconfirmed, ran on "yes", trace
  written); live weather from Open-Meteo; live Wikipedia summary;
  joke/advice banks (16 original lines each); device report; SQLite
  round-trips; cost maths against published rates; memory
  ADD/NOOP/recall/forget round-trips; RAG indexing of a fixture note
  with the citation checked; no-key degradation messages; Ollama-absent
  behaviour; face module guards + Haar cascade load; the local API over
  real HTTP (health, 401 without token, command, stats); the built web
  bundle's UI markers; the mobile app's presence checks.
- **Frontend:** `npm run build` (TypeScript strict + Vite) clean;
  bundle ~273 KB (84 KB gzip) into `www/`.
- **Mobile:** `npx tsc --noEmit` clean; `npx expo export` produced the
  Android bundle (1.82 MB Hermes bytecode), exit 0.
- **Python lint:** ruff clean.
- Sandbox notes: the suite's embedding tests ran on the built-in
  fallback embedder because the torch download kept failing in the
  sandbox network (the real MiniLM model is in `requirements.txt` and
  downloads on first use on the PC — the code picks it automatically
  when present). OpenCV is pinned below 5.0 in requirements because
  OpenCV 5 wheels dropped the bundled Haar cascade file (found during
  testing; the loader's error message explains this too).
- Camera/mic/speaker paths are capability-guarded and were verified by
  code path + guards; they get their real test on Randhir's PC.

## Round 2 — three research-picked additions (2026-10-27)

A second research round compared what advanced assistants (2026) do
and picked three additions. All code is original, written fresh; each
one reuses the existing core instead of bolting on a parallel system.

### 1. MCP server — other AI tools can now use the assistant's tools

**What it is, in simple words.** MCP (Model Context Protocol) is a
standard plug that lets AI programs call tools from other programs.
The assistant already had 34 typed "tools" inside it. This addition
puts those same tools on the standard plug, so programs like Claude
Code or Cursor can ask the assistant's own machinery to do things:
check the time, search the notes, read the memory, and so on.

**How it was built.**

- A new `mcp_server/` package with ONE adapter: it reads the existing
  tool registry and, for each tool, builds a matching MCP tool whose
  button-press goes straight into the same executor the assistant
  itself uses. No tool logic was copied or rewritten — so schema
  checking, the activity traces and the ₹ cost log all apply to MCP
  calls automatically.
- It uses the **official Python SDK v2** (`mcp>=2,<3`, pinned in
  requirements). The research warned that the old v1 "FastMCP" import
  no longer exists in the official SDK and a separate package with a
  similar name is a different project — so the code imports
  `MCPServer` from `mcp.server`, exactly as the current SDK documents.
- Transport is **stdio** (the host starts the server as a subprocess;
  there is no network port and nothing to attack from outside).
  Anything a tool might print is forced to stderr so it can never
  corrupt the protocol stream on stdout.
- **Two profiles.** `readonly` = only safe tools are even offered
  (30 of 34). `actions` = all 34 offered, but the 4 destructive ones
  (send WhatsApp, delete contact, forget memory, phone actions)
  **refuse with a written explanation**, because a headless call has
  no screen where the owner could press "yes". They execute only when
  the owner deliberately starts the server with
  `--allow-destructive` (or `PAI_MCP_ALLOW_DESTRUCTIVE=1`). This is
  the same confirmation rule as the main app, adapted honestly to a
  surface with no UI.
- Notes and memory are also exposed as read-only MCP *resources*
  (`notes://index`, `memory://profile`).

**How it was verified.** A real MCP client in the test suite starts
the server over stdio, lists tools (30 vs 34 by profile), calls
`time_now` and gets the executor's real answer, confirms a destructive
call is refused and the seeded contact survives, then restarts with
the allow flag and confirms the delete actually happens.

### 2. Offline speech-to-text — your voice stops leaving the PC

**What it is.** Before, speaking to the assistant sent the recording
to Google's online recogniser. Now the first choice is **faster-
whisper**: a local Whisper model (`small`, int8, CPU) that transcribes
the recording on the PC itself. No key, no upload, works without
internet. If the package or model is missing, the assistant quietly
falls back to the online recogniser — and Settings shows which one is
active, so the fallback is never a secret.

**Details that matter.**

- It transcribes a *finished* push-to-talk recording in short chunks
  (up to 30 seconds each) with a voice-activity filter. It is NOT
  fake "live streaming" — the README says "offline transcription" in
  plain words, because Whisper does not truly stream.
- CPU threads are **capped at 4**: the research found a report that
  int8 with many threads can drop speech, so the safe setting is the
  default (`PAI_WHISPER_THREADS` can lower it, never raise past 4).
- Settings to control it: `PAI_STT_PROVIDER=auto|faster-whisper|default`,
  `PAI_WHISPER_MODEL=small`. First use downloads ~500 MB of model.
- Audio files are decoded inside the module (stdlib WAV decoder, PyAV
  for other formats). Reason: faster-whisper 1.2.1's own file decoder
  is broken with the newest PyAV (found during testing — a keyword
  argument was removed upstream), so the code feeds it decoded
  samples instead of file paths. That path is stable across versions.

**How it was verified.** In the sandbox the model actually downloaded
and ran: a synthetic tone file transcribed without crashing (empty
text, correctly — tones are not speech), and a real speech recording
(the famous JFK "ask not what your country can do for you" clip)
transcribed **word-perfect, fully offline**. The smoke suite accepts
either a successful transcription or a clean skip-with-reason (for
machines where the model cannot download), and prints which happened.

### 3. Ask-my-notes v2 — hybrid search, reranking, and honest numbers

**What changed, in simple words.** Version 1 searched notes only by
*meaning* (vector embeddings). Version 2 searches two ways at once
and merges the results:

1. **Expansion first:** the question is widened by simple rules —
   plurals folded ("universities" → also "university") and a small
   synonym list ("exam" → also "test", "paper"). Always on, no AI
   needed. An LLM-based question-rewriting helper exists but is a
   *gated stub*: it only tries when a chat key is configured and the
   provider actually answers; otherwise retrieval proceeds without it.
2. **Two searches:** the existing vector search (meaning) **plus** a
   BM25 keyword search over the same chunks, stored in a SQLite FTS5
   table that is kept in sync every time notes are indexed. Keyword
   search is what nails exact things — names, codes, dates, "PNR".
3. **Fusion:** the two ranked lists are merged with Reciprocal Rank
   Fusion (the standard recipe, k=60): a chunk ranked high by either
   search rises; a chunk both searches like rises most.
4. **Rerank (when available):** a small local cross-encoder model
   (`ms-marco-MiniLM-L-6-v2`, ~90 MB) re-reads the top candidates
   against the question and re-orders them. It is ON by default when
   the model can load (`PAI_RAG_RERANK=0` turns it off), and Settings
   shows its true status (installed? loaded? active?). If it cannot
   load, the fused order is used — the same honesty pattern as the
   embedder fallback from Round 1.

**Measured, not claimed.** A golden set of 26 hand-written questions
over 12 fixture notes (`tests/fixtures/rag_golden.jsonl`) is scored by
`python tests/measure_rag.py` (recall@5 = was the right note in the
top 5?). Numbers from the actual sandbox run:

| configuration | recall@5 |
|---|---|
| vector-only | 0.96 (25/26) |
| hybrid (vector + BM25, RRF) | 0.96 (25/26) |
| hybrid + rerank | not measurable in the sandbox — the reranker model could not be installed here (same torch download limit as Round 1); the code path is unit-tested with a stub reranker and will run for real on the PC |

Read the tie honestly: in this sandbox the "vector" leg runs on the
lexical fallback embedder (no torch), so both legs are word-based and
a tie is expected. On the PC the vector leg becomes true semantic
search (MiniLM), which is the combination the research measured as
strictly better on larger corpora — and the one question both
configurations missed here ("how long does the mango pickle need to
rest?" — the note says "let it rest") is exactly the paraphrase kind
a semantic embedder + reranker is built to catch. The script stays in
the repo so the measurement can be re-run on the PC and the numbers
replaced with real ones.

**Suite status after Round 2: 58/58 checks pass** (the original 45
plus 13 new ones covering the FTS mirror, fusion maths, expansion,
hybrid stages, the stubbed rerank path, the golden-set script, STT
provider selection + transcription, and the three MCP profile
checks). Ruff clean; the web bundle was rebuilt for the two new
Settings rows (speech-to-text engine + notes reranker status).

**Round-2 commits:** `add mcp server` · `add offline speech to text` ·
`add rag v2 hybrid retrieval` · `add tests and docs`.

---

## Commits (grouped, short messages)

Local → remote (content trees verified identical; remote SHAs differ
only in commit metadata encoding):

1. `add core engine and entry points`
2. `add tools rag memory and stats`
3. `add react ui`
4. `add local api`
5. `add mobile companion app`
6. `add tests and docs`
7. `fix lint issues` — remote HEAD `be95127`

## Skills applied during the build

- **senior_architect** — modular-monolith layout, capability-guard
  seams, decisions recorded in the README.
- **python_pro** — package layout, type hints, stdlib-first I/O.
- **python_testing_patterns** — the headless smoke-suite approach.
- **ui_ux_pro_max** — accessibility (contrast ≥ 4.5:1, ≥ 44 px
  targets, aria labels, focus rings, reduced-motion), semantic tokens.
- **no_ai_design_slop** — one visual thesis ("quiet control room":
  graphite surfaces, a single mint accent, hierarchy from type and
  spacing; no purple gradients, no glow, no emoji icons — SVG only).
- **documentation_pro** — README anatomy: setup, architecture diagram,
  keys table, per-surface capability matrix, honest roadmap.
- Plus the standout-features research (tool-calling, personal RAG,
  semantic memory, cost dashboard, Ollama) that shaped the additions.

## Morning checklist (owner steps on his PC)

1. Clone the repo, run `start.bat` (creates the venv, installs
   dependencies, builds the UI if needed, starts the assistant).
2. Copy `.env.example` → `.env`, then add keys as available:
   - `GEMINI_API_KEY` — free, from Google AI Studio (the chat brain).
   - `PORCUPINE_ACCESS_KEY` — free, from the Picovoice Console (wake
     word; the built-in keyword is "computer" unless a custom
     "Personal AI" keyword file is dropped in as
     `PORCUPINE_KEYWORD_PATH`).
   - `HF_TOKEN` — optional fallback chat provider.
   - `OWNER_PIN` — a PIN he chooses, for the face-unlock fallback.
3. Run `python setup_face.py` once (webcam needed) for face unlock,
   then restart the assistant.
4. Add contacts in the Contacts tab; drop documents into `notes/` and
   say "reindex my notes".
5. For phone/web access: set `PAI_API_ALLOW_LAN=1` in `.env`, run
   `python -m server_api`, read the pairing token in
   Settings → Web & mobile access, and pair the Expo app
   (`cd mobile && npx expo start`, scan with Expo Go).

Everything else — weather, Wikipedia, jokes, notes, memory, device
status, image generation — already works with zero keys.
