"""One-off: create the first test account (in-process, writes backend/users.db).
Vault schema matches the webapp's Vault type exactly."""
import base64

from fastapi.testclient import TestClient

import crypto_utils as C

# importing main would load the ML pipeline; the router alone is enough
from fastapi import FastAPI
import userdb

app = FastAPI()
app.include_router(userdb.router)
api = TestClient(app)

USERNAME, PASSWORD = "testuser", "testUSER123!"

salt = C.new_salt()
enc_key, auth_key = C.derive_keys(PASSWORD, salt)
r = api.post("/api/auth/register", json={
    "username": USERNAME, "salt_hex": salt.hex(), "auth_key_hex": auth_key.hex()})
print("register:", r.status_code, r.json())

vault = {"version": 1,
         "profile": {"focus": "certainty", "response": "check again",
                     "moment": "leaving the house", "goal": "understand my loops"},
         "thoughts": [], "memos": [], "cats": [], "connections": []}
blob = C.encrypt_vault(enc_key, vault)
r = api.post("/api/auth/vault/upload", json={
    "username": USERNAME, "auth_key_hex": auth_key.hex(),
    "vault_b64": base64.b64encode(blob).decode()})
print("vault upload:", r.status_code, r.json())
print(f"created → username: {USERNAME}  password: {PASSWORD}")
