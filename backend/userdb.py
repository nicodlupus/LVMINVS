"""
Zero-knowledge user accounts — merged from UserTestManagement/server.py.

Stores per user: username · salt · auth_hash · encrypted vault blob. Nothing
else. Key derivation and vault encryption happen on the device (webapp,
@noble/hashes scrypt + WebCrypto AES-GCM, same parameters as crypto_utils.py);
this server can authenticate users but never decrypt them.
"""
from __future__ import annotations

import base64
import sqlite3
import time
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from crypto_utils import auth_hash
from usernames import random_username

DB = Path(__file__).parent / "users.db"
router = APIRouter(prefix="/api/auth")


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


@router.get("/username/new")
def propose_username() -> dict:
    con = db()
    for _ in range(20):
        name = random_username()
        if con.execute("SELECT 1 FROM users WHERE username=?", (name,)).fetchone() is None:
            return {"username": name}
    raise HTTPException(500, "could not find a free username")


@router.post("/register")
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


@router.get("/salt/{username}")
def get_salt(username: str) -> dict:
    row = db().execute("SELECT salt FROM users WHERE username=?", (username,)).fetchone()
    if row is None:
        raise HTTPException(404, "unknown user")
    return {"salt_hex": row[0]}


@router.post("/vault/upload")
def upload(body: VaultIn) -> dict:
    con = db()
    _verify(con, body.username, body.auth_key_hex)
    con.execute("UPDATE users SET vault=?, updated=? WHERE username=?",
                (base64.b64decode(body.vault_b64), time.time(), body.username))
    con.commit()
    return {"ok": True}


@router.post("/vault/download")
def download(body: AuthIn) -> dict:
    con = db()
    _verify(con, body.username, body.auth_key_hex)
    row = con.execute("SELECT vault FROM users WHERE username=?", (body.username,)).fetchone()
    if row[0] is None:
        raise HTTPException(404, "no vault stored yet")
    return {"vault_b64": base64.b64encode(row[0]).decode()}


@router.post("/rename")
def rename(body: RenameIn) -> dict:
    con = db()
    _verify(con, body.username, body.auth_key_hex)
    try:
        con.execute("UPDATE users SET username=? WHERE username=?",
                    (body.new_username, body.username))
        con.commit()
    except sqlite3.IntegrityError:
        raise HTTPException(409, "username taken")
    return {"ok": True, "username": body.new_username}
