"""
Zero-knowledge crypto core. Free/standard primitives only:

  scrypt  — memory-hard key derivation from the password (cryptography pkg)
  HKDF    — splits the master key into two INDEPENDENT keys:
              enc_key  : encrypts the vault, never leaves the device
              auth_key : proves identity to the server, which stores only
                         its hash — so the server can authenticate a user
                         while being mathematically unable to decrypt them
  AES-GCM — authenticated encryption of the vault (tamper = decrypt fails)

The username is NOT part of the derivation (only the random salt is), so a
username change never forces re-encryption.
"""
from __future__ import annotations

import hashlib
import json
import os

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives.kdf.scrypt import Scrypt

SALT_BYTES = 16
NONCE_BYTES = 12


def new_salt() -> bytes:
    return os.urandom(SALT_BYTES)


def derive_keys(password: str, salt: bytes) -> tuple[bytes, bytes]:
    """password + salt → (enc_key, auth_key), each 32 bytes."""
    master = Scrypt(salt=salt, length=32, n=2**14, r=8, p=1).derive(password.encode())

    def expand(info: bytes) -> bytes:
        return HKDF(algorithm=hashes.SHA256(), length=32, salt=None, info=info).derive(master)

    return expand(b"vault-encryption"), expand(b"server-auth")


def auth_hash(auth_key: bytes) -> str:
    """What the server is allowed to store."""
    return hashlib.sha256(auth_key).hexdigest()


def encrypt_vault(enc_key: bytes, vault: dict) -> bytes:
    nonce = os.urandom(NONCE_BYTES)
    ct = AESGCM(enc_key).encrypt(nonce, json.dumps(vault, ensure_ascii=False).encode(), None)
    return nonce + ct


def decrypt_vault(enc_key: bytes, blob: bytes) -> dict:
    """Raises on wrong key or tampered blob — failure is cryptographic, not policy."""
    pt = AESGCM(enc_key).decrypt(blob[:NONCE_BYTES], blob[NONCE_BYTES:], None)
    return json.loads(pt)
