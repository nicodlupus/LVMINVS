"""
Zero-knowledge account server (FastAPI + stdlib sqlite3, all free).

What it stores per user — and NOTHING else:
  username    random, user-changeable
  salt        public KDF salt (salts are not secrets)
  auth_hash   sha256 of the auth key — lets us verify, never decrypt
  vault       one opaque encrypted blob (the user's entire data)

Deliberately absent: location, device ids, social anything, plaintext of any
user content. The server cannot read the vault even if compelled to try.
"""
from __future__ import annotations

import base64
import sqlite3
import time
from pathlib import Path

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from crypto_utils import auth_hash
from usernames import random_username

DB = Path(__file__).parent / "users.db"
app = FastAPI(title="LVMINVS user management (test)")


def db() -> sqlite3.Connection:
    con = sqlite3.connect(DB)
    con.execute("""CREATE TABLE IF NOT EXISTS users(
        username  TEXT PRIMARY KEY,
        salt      TEXT NOT NULL,
        auth_hash TEXT NOT NULL,
        vault     BLOB,
        updated   REAL)""")
    return con


def _verify(con: sqlite3.Connection, username: str, auth_key_hex: str) -> None:
    row = con.execute("SELECT auth_hash FROM users WHERE username=?", (username,)).fetchone()
    if row is None or auth_hash(bytes.fromhex(auth_key_hex)) != row[0]:
        raise HTTPException(401, "unknown user or wrong credentials")


class RegisterIn(BaseModel):
    username: str
    salt_hex: str
    auth_key_hex: str


class AuthIn(BaseModel):
    username: str
    auth_key_hex: str


class VaultIn(AuthIn):
    vault_b64: str


class RenameIn(AuthIn):
    new_username: str


@app.get("/api/username/new")
def propose_username() -> dict:
    con = db()
    for _ in range(20):
        name = random_username()
        if con.execute("SELECT 1 FROM users WHERE username=?", (name,)).fetchone() is None:
            return {"username": name}
    raise HTTPException(500, "could not find a free username")


@app.post("/api/register")
def register(body: RegisterIn) -> dict:
    con = db()
    try:
        con.execute("INSERT INTO users(username, salt, auth_hash, vault, updated) VALUES(?,?,?,?,?)",
                    (body.username, body.salt_hex,
                     auth_hash(bytes.fromhex(body.auth_key_hex)), None, time.time()))
        con.commit()
    except sqlite3.IntegrityError:
        raise HTTPException(409, "username taken")
    return {"ok": True, "username": body.username}


@app.get("/api/salt/{username}")
def get_salt(username: str) -> dict:
    """Pre-auth by design: a new device needs the salt to derive its keys."""
    row = db().execute("SELECT salt FROM users WHERE username=?", (username,)).fetchone()
    if row is None:
        raise HTTPException(404, "unknown user")
    return {"salt_hex": row[0]}


@app.post("/api/vault/upload")
def upload(body: VaultIn) -> dict:
    con = db()
    _verify(con, body.username, body.auth_key_hex)
    con.execute("UPDATE users SET vault=?, updated=? WHERE username=?",
                (base64.b64decode(body.vault_b64), time.time(), body.username))
    con.commit()
    return {"ok": True}


@app.post("/api/vault/download")
def download(body: AuthIn) -> dict:
    con = db()
    _verify(con, body.username, body.auth_key_hex)
    row = con.execute("SELECT vault FROM users WHERE username=?", (body.username,)).fetchone()
    if row[0] is None:
        raise HTTPException(404, "no vault stored yet")
    return {"vault_b64": base64.b64encode(row[0]).decode()}


@app.post("/api/rename")
def rename(body: RenameIn) -> dict:
    """Username is not a KDF input, so renaming is free — no re-encryption."""
    con = db()
    _verify(con, body.username, body.auth_key_hex)
    try:
        con.execute("UPDATE users SET username=? WHERE username=?",
                    (body.new_username, body.username))
        con.commit()
    except sqlite3.IntegrityError:
        raise HTTPException(409, "username taken")
    return {"ok": True, "username": body.new_username}


@app.get("/api/health")
def health() -> dict:
    n = db().execute("SELECT COUNT(*) FROM users").fetchone()[0]
    return {"ok": True, "users": n}
