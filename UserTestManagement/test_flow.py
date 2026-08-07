"""
End-to-end proof of the zero-knowledge flow, headless (no server process —
FastAPI TestClient drives server.py in-process).

  ./.venv/bin/python test_flow.py       (from backend/.venv, has all deps)
"""
from __future__ import annotations

import sqlite3
import tempfile
from pathlib import Path

from fastapi.testclient import TestClient

import server
from client import Device

PASSWORD = "correct horse battery staple"
ANSWERS = {"focus": "certainty", "response": "check again",
           "moment": "leaving the house", "goal": "understand my loops"}


def main() -> None:
    server.DB.unlink(missing_ok=True)              # fresh test database
    api = TestClient(server.app)
    tmp = Path(tempfile.mkdtemp())
    ok = 0

    # 1 · signup on device A: random username, onboarding answers into vault
    phone = Device(tmp / "deviceA", api)
    username = phone.signup(PASSWORD, ANSWERS)
    assert "-" in username, "username should be random word-word-NN"
    print(f"1 ✓ signup → random username: {username}");  ok += 1

    # 2 · use the app: a thought lands in the vault and syncs
    phone.add_thought({"thought": "What if I didn't lock the door?", "intensity": 7})
    phone.sync()
    print("2 ✓ thought stored and synced (encrypted)");  ok += 1

    # 3 · the SERVER can NOT read anything: inspect the raw DB
    raw = sqlite3.connect(server.DB).execute(
        "SELECT vault FROM users WHERE username=?", (username,)).fetchone()[0]
    for secret in (b"lock the door", b"certainty", PASSWORD.encode()):
        assert secret not in raw, f"PLAINTEXT LEAKED: {secret!r}"
    print(f"3 ✓ server-side blob is opaque ({len(raw)} bytes, no plaintext inside)");  ok += 1

    # 4 · new device + WRONG password → cryptographic failure, no data
    thief = Device(tmp / "thief", api)
    try:
        thief.restore(username, "wrong password")
        raise AssertionError("wrong password must not decrypt")
    except Exception as e:
        assert not isinstance(e, AssertionError)
        print(f"4 ✓ wrong password rejected ({type(e).__name__})");  ok += 1

    # 5 · new device + correct username+password → full vault restored
    tablet = Device(tmp / "deviceB", api)
    vault = tablet.restore(username, PASSWORD)
    assert vault["profile"] == ANSWERS
    assert vault["thoughts"][0]["thought"] == "What if I didn't lock the door?"
    print("5 ✓ restore on new device: profile + thoughts intact");  ok += 1

    # 6 · rename: free (username is not a KDF input), old name dies
    tablet.rename("my-own-name-7")
    assert api.get("/api/salt/my-own-name-7").status_code == 200
    assert api.get(f"/api/salt/{username}").status_code == 404
    v2 = Device(tmp / "deviceC", api).restore("my-own-name-7", PASSWORD)
    assert v2["profile"] == ANSWERS
    print("6 ✓ username changed, restore still works, old name gone");  ok += 1

    # 7 · what the server knows about a user, in total
    cols = sqlite3.connect(server.DB).execute("SELECT * FROM users").description
    print(f"7 ✓ server's complete knowledge: {[c[0] for c in cols]}");  ok += 1

    print(f"\nALL {ok}/7 PASSED — zero-knowledge flow works")


if __name__ == "__main__":
    main()
