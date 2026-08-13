# LVMINVS

A research-state web-data application that uses AI and GenAI technologies to help
people learn in depth their thinking processes and their intrusive patterns.

It is for noticing compulsions and overthinking, and understanding yourself better —
not a clinical tool and not limited to a diagnosis. Everyone loops on something, at
some scale.

**Institution:** University of Nicosia · **Course:** COMP-248
**Supervisor:** Dr. Ioannis Katakis

Two ideas carry the project:

1. **The model is contained.** A general chatbot would make this app redundant — you
   could just use ChatGPT. Here the language model never decides what happens in a
   conversation; a deterministic policy does, and the model is only allowed to
   verbalize that decision.
2. **Your records are yours.** Everything you write is encrypted on your own device
   with a key derived from your password. The server stores an opaque blob it cannot
   read.

---

## Architecture

```
                         ┌──────────────── webapp (React + TypeScript) ────────────────┐
   user text ───────────►│  encrypts vault on-device · renders the conversation        │
                         └────────────────────────────┬───────────────────────────────-┘
                                                      │  /api
                         ┌────────────────────────────▼───────────────── backend (FastAPI) ─┐
                         │                                                                  │
   [1] ENCODER      sentence-transformers kNN over the clinician CSV ontology                │
                    → category · emotion · distortion · compulsion type · confidence         │
                                                      │                                     │
   [2] RETRIEVER    embedded chunks of the OCD manuals (PDF) → the only passages             │
                    the model is permitted to draw on                                        │
                                                      │                                     │
   [3] POLICY       deterministic: mode + turn + classification → InstructionPlan            │
                    (intent, the single question to ask, forbidden acts, length cap)         │
                                                      │                                     │
   [4] RENDERER     OpenAI receives the plan ONLY, and verbalizes it                         │
                                                      │                                     │
   [5] VALIDATOR    re-reads the reply; strips reassurance and certainty claims —            │
                    the cardinal sins of this application                                   │
                         └──────────────────────────────────────────────────────────────────┘
```

The model never sees "be a therapist". It sees a plan and a contract. Hard gates
(may a thought enter the map? may a pattern be suggested? how strong is it?) are
enforced in Python **after** generation, not requested in a prompt.

### Why an encoder rather than more prompt engineering

Prompt instructions are advisory; the model may ignore them. The encoder, policy and
validator are code — they cannot be talked out of their behaviour. The dataset and the
manuals enter as *preprocessing*, so the vocabulary and the evidence are fixed before
the model is ever called.

### Zero-knowledge accounts

```
password ──scrypt(salt)──► master ──HKDF──┬─► enc_key   never leaves the device (AES-GCM vault)
                                          └─► auth_key  server stores only sha256(auth_key)
```

The server's complete knowledge of a user is four columns:
`username · salt · auth_hash · encrypted blob`.

- No location. No third-party or social integrations. No plaintext at rest.
- Usernames are random at signup (`amber-heron-42`) and free to change — the username
  is not an input to key derivation.
- A new device restores from username + password alone. A wrong password cannot
  decrypt: the failure is cryptographic, not a policy check.
- **Caveat, stated plainly:** to answer a live turn, the current message text is sent
  to the OpenAI API (with `store=False`). Encryption protects everything at rest and
  everything in our database; it does not make the live inference call local.
- Session keys currently live in `localStorage`. Adequate for private testing; before
  any release they belong in the OS keychain of a native shell.

---

## Learning from use

Two endpoints let the app improve without a bespoke study — the app is its own
evaluation set. Both are anonymous by construction: no username, no auth key,
no prior message text. Only the assistant reply being judged and what the user
consciously typed as feedback leave the device.

- `POST /api/feedback` — a per-reply star rating (1-5) with an optional short
  recommendation. Appended to `backend/feedback.jsonl`.
- `POST /api/classification-feedback` — the user's verdict on the encoder's
  read of the discomfort ("correct" or a short "it was more like…").
  Appended to `backend/classification_feedback.jsonl`.

Both files are gitignored. The UI surfaces the encoder's read inline on the
last bubble of each turn ("The companion read this as *safety · unease*") so
the classifier is never invisible — every prediction is presented for
confirmation or correction.

---

## Layout

| path | what it is |
|---|---|
| `webapp/` | React 18 + TypeScript + Tailwind v4 (Vite). Responsive, no fixed phone frame. |
| `backend/` | FastAPI service: encoder, retriever, policy, renderer, validator, accounts. |
| `UserTestManagement/` | Standalone build + test of the zero-knowledge scheme, kept as its own proof. |
| `ocd_prototype_app_example/` | The original single-file HTML prototype, kept for reference. |

## Running it

```bash
# backend  (first run: build the embedding cache from the CSV + PDFs)
cd backend
python3 -m venv .venv && ./.venv/bin/pip install -r requirements.txt
./.venv/bin/python ingest.py
./.venv/bin/uvicorn main:app --port 5055

# frontend
cd webapp && npm install && npm run dev      # http://localhost:5173
```

Set `OPENAI_API_KEY` — see `.env.example`.

Verify the privacy claims yourself:

```bash
cd UserTestManagement && ../backend/.venv/bin/python test_flow.py
```

It asserts, among other things, that the raw server-side blob contains none of the
user's plaintext, and that a wrong password yields no data.

## Roadmap

- Fine-tune a small seq2seq on `(reply, rating, classification, verdict, correction)`
  tuples to replace the rule-based policy — the honest path to a model of our own,
  bootstrapped by the app rather than assumed up front. Data collection is already
  running (see *Learning from use*); the `(user text → plan)` half is deliberately
  excluded so the training signal never contains what the user wrote.
- Real dictation via the Web Speech API (the microphone is currently simulated).
- PWA manifest, so it installs on a phone — an app meant to be opened mid-episode
  should be one tap away.

## Status

Private research prototype developed for COMP-248 at the University of Nicosia under
the supervision of Dr. Ioannis Katakis. Not a medical device; it does not diagnose or
treat.

## License

Apache License 2.0 — see [LICENSE](LICENSE).
