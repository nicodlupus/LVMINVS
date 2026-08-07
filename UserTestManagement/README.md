# UserTestManagement — zero-knowledge accounts (standalone test)

Free tools only: FastAPI, sqlite3 (stdlib), `cryptography`.

## Scheme
```
password ──scrypt(random salt)──► master ──HKDF──┬─► enc_key   never leaves device; AES-GCM encrypts the vault
                                                 └─► auth_key  sent to server, which stores only sha256(auth_key)
```
- Server stores per user: `username · salt · auth_hash · encrypted vault blob`. Nothing else — no location, no device ids, no third-party anything.
- The vault (profile answers, thoughts, memos, chat log) is encrypted **on the device**; the server and OpenAI never see plaintext at rest.
- New device: username + password → fetch salt → re-derive keys → download + decrypt. Wrong password fails cryptographically (AES-GCM), not by policy.
- Username is random at signup (`amber-heron-42`), user-changeable for free — it is not a KDF input.

## Run
```bash
../backend/.venv/bin/python test_flow.py     # end-to-end proof, in-process
../backend/.venv/bin/uvicorn server:app --port 5056   # optional live server
```

## Merge plan (after approval)
- server.py endpoints move into `backend/main.py`
- client.py logic becomes TypeScript in the webapp (WebCrypto: PBKDF2/AES-GCM), vault kept in IndexedDB, synced as one blob
- Inference caveat: the current message text still goes to OpenAI (with `store=False`) to get a reply — encryption covers storage, not the live turn.
