"""
The "device" side. In the merged app this logic lives in the frontend/native
shell; here it is a Python class so the whole flow is testable headlessly.

The device keeps enc_key in its local state file (the stand-in for the OS
keychain). The server never receives it, in any form.
"""
from __future__ import annotations

import base64
import json
from pathlib import Path

import crypto_utils as C

# ── onboarding: the questions that seed the personalization profile ──────
ONBOARDING = [
    ("focus",     "When your mind loops, what does it loop on most? (safety, health, "
                  "certainty, morality, self-worth, relationships)"),
    ("response",  "What do you usually do to make the discomfort stop? "
                  "(check again, ask for reassurance, repeat a phrase, replay events, other)"),
    ("moment",    "When does it visit you most — mornings, evenings, alone, at work?"),
    ("goal",      "What would you like to understand about yourself here?"),
]


def empty_vault(profile: dict) -> dict:
    return {"version": 1, "profile": profile,
            "thoughts": [], "memos": [], "connections": [], "chat_log": []}


class Device:
    """One physical device. `state_dir` is its private storage."""

    def __init__(self, state_dir: str | Path, api):
        self.dir = Path(state_dir)
        self.dir.mkdir(parents=True, exist_ok=True)
        self.api = api                      # anything with .get/.post (TestClient or httpx)
        self._state = json.loads((self.dir / "state.json").read_text()) \
            if (self.dir / "state.json").exists() else None

    # ── local key cache (the "keychain") ─────────────────────────────────
    def _save_state(self, username: str, enc_key: bytes, auth_key: bytes, vault: dict) -> None:
        self._state = {"username": username, "enc_key": enc_key.hex(),
                       "auth_key": auth_key.hex()}
        (self.dir / "state.json").write_text(json.dumps(self._state))
        (self.dir / "vault.json").write_text(json.dumps(vault, ensure_ascii=False))

    @property
    def vault(self) -> dict:
        return json.loads((self.dir / "vault.json").read_text())

    # ── flows ────────────────────────────────────────────────────────────
    def signup(self, password: str, answers: dict) -> str:
        username = self.api.get("/api/username/new").json()["username"]
        salt = C.new_salt()
        enc_key, auth_key = C.derive_keys(password, salt)
        r = self.api.post("/api/register", json={
            "username": username, "salt_hex": salt.hex(), "auth_key_hex": auth_key.hex()})
        r.raise_for_status()
        vault = empty_vault({k: answers.get(k, "") for k, _ in ONBOARDING})
        self._save_state(username, enc_key, auth_key, vault)
        self.sync()
        return username

    def add_thought(self, thought: dict) -> None:
        vault = self.vault
        vault["thoughts"].append(thought)
        (self.dir / "vault.json").write_text(json.dumps(vault, ensure_ascii=False))

    def sync(self) -> None:
        """Encrypt locally, ship the ciphertext. Plaintext never leaves."""
        blob = C.encrypt_vault(bytes.fromhex(self._state["enc_key"]), self.vault)
        r = self.api.post("/api/vault/upload", json={
            "username": self._state["username"],
            "auth_key_hex": self._state["auth_key"],
            "vault_b64": base64.b64encode(blob).decode()})
        r.raise_for_status()

    def restore(self, username: str, password: str) -> dict:
        """New device: username + password are the only recovery path."""
        salt = bytes.fromhex(self.api.get(f"/api/salt/{username}").json()["salt_hex"])
        enc_key, auth_key = C.derive_keys(password, salt)
        r = self.api.post("/api/vault/download", json={
            "username": username, "auth_key_hex": auth_key.hex()})
        r.raise_for_status()
        vault = C.decrypt_vault(enc_key, base64.b64decode(r.json()["vault_b64"]))
        self._save_state(username, enc_key, auth_key, vault)
        return vault

    def rename(self, new_username: str) -> None:
        r = self.api.post("/api/rename", json={
            "username": self._state["username"],
            "auth_key_hex": self._state["auth_key"],
            "new_username": new_username})
        r.raise_for_status()
        self._state["username"] = new_username
        (self.dir / "state.json").write_text(json.dumps(self._state))
