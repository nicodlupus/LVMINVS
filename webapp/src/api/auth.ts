/*
 * Device-side zero-knowledge crypto. MUST stay parameter-identical to
 * backend/crypto_utils.py:
 *   scrypt(password, salt16, N=2^14, r=8, p=1) → master(32)
 *   HKDF-SHA256(master, info) → enc_key ("vault-encryption") + auth_key ("server-auth")
 *   AES-GCM, 12-byte nonce prefixed to ciphertext
 * enc_key never leaves this file's callers; the server stores sha256(auth_key).
 */
import { hkdf } from "@noble/hashes/hkdf.js";
import { scrypt } from "@noble/hashes/scrypt.js";
import { sha256 } from "@noble/hashes/sha2.js";

import type { Category, Connection, Memo, Thought } from "../types";

export interface Vault {
  version: number;
  profile: Record<string, string>;
  thoughts: Thought[];
  memos: Memo[];
  cats: Category[];
  connections: Connection[];
}

export interface Session {
  username: string;
  encKeyHex: string;
  authKeyHex: string;
}

const SESSION_KEY = "lvminvs.session";
const NONCE_BYTES = 12;

/* ── encoding helpers ─────────────────────────────────────────────────── */
const toHex = (b: Uint8Array) => Array.from(b, x => x.toString(16).padStart(2, "0")).join("");
const fromHex = (h: string) => new Uint8Array(h.match(/.{2}/g)!.map(x => parseInt(x, 16)));
const toB64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));
const fromB64 = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0));

/* ── key derivation (matches crypto_utils.derive_keys) ────────────────── */
export function deriveKeys(password: string, salt: Uint8Array) {
  const master = scrypt(password, salt, { N: 2 ** 14, r: 8, p: 1, dkLen: 32 });
  const info = (s: string) => new TextEncoder().encode(s);   // v2 wants bytes
  return {
    encKey: hkdf(sha256, master, undefined, info("vault-encryption"), 32),
    authKey: hkdf(sha256, master, undefined, info("server-auth"), 32),
  };
}

/* ── vault encryption (WebCrypto AES-GCM) ─────────────────────────────── */
async function aesKey(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", raw as BufferSource, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptVault(encKeyHex: string, vault: Vault): Promise<string> {
  const nonce = crypto.getRandomValues(new Uint8Array(NONCE_BYTES));
  const ct = new Uint8Array(await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce as BufferSource }, await aesKey(fromHex(encKeyHex)),
    new TextEncoder().encode(JSON.stringify(vault))));
  const blob = new Uint8Array(nonce.length + ct.length);
  blob.set(nonce); blob.set(ct, nonce.length);
  return toB64(blob);
}

export async function decryptVault(encKeyHex: string, vaultB64: string): Promise<Vault> {
  const blob = fromB64(vaultB64);
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: blob.slice(0, NONCE_BYTES) as BufferSource },
    await aesKey(fromHex(encKeyHex)), blob.slice(NONCE_BYTES) as BufferSource);
  return JSON.parse(new TextDecoder().decode(pt));
}

/* ── server calls ─────────────────────────────────────────────────────── */
async function api(path: string, body?: unknown): Promise<any> {
  const r = await fetch(`/api/auth${path}`, body === undefined
    ? undefined
    : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await r.json();
  if (!r.ok) throw new Error(data.detail || r.statusText);
  return data;
}

export const proposeUsername = (): Promise<string> =>
  api("/username/new").then(d => d.username);

export async function signup(username: string, password: string,
                             profile: Record<string, string>): Promise<{ session: Session; vault: Vault }> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const { encKey, authKey } = deriveKeys(password, salt);
  await api("/register", { username, salt_hex: toHex(salt), auth_key_hex: toHex(authKey) });
  const session: Session = { username, encKeyHex: toHex(encKey), authKeyHex: toHex(authKey) };
  const vault: Vault = { version: 1, profile, thoughts: [], memos: [], cats: [], connections: [] };
  await uploadVault(session, vault);
  return { session, vault };
}

export async function login(username: string, password: string): Promise<{ session: Session; vault: Vault }> {
  const { salt_hex } = await api(`/salt/${encodeURIComponent(username)}`);
  const { encKey, authKey } = deriveKeys(password, fromHex(salt_hex));
  const session: Session = { username, encKeyHex: toHex(encKey), authKeyHex: toHex(authKey) };
  const { vault_b64 } = await api("/vault/download",
    { username, auth_key_hex: session.authKeyHex });
  const vault = await decryptVault(session.encKeyHex, vault_b64);   // wrong pw → throws here
  return { session, vault };
}

export async function uploadVault(session: Session, vault: Vault): Promise<void> {
  await api("/vault/upload", {
    username: session.username, auth_key_hex: session.authKeyHex,
    vault_b64: await encryptVault(session.encKeyHex, vault),
  });
}

/* ── local session (the "keychain") ───────────────────────────────────── */
export const loadSession = (): Session | null => {
  const raw = localStorage.getItem(SESSION_KEY);
  return raw ? JSON.parse(raw) : null;
};
export const saveSession = (s: Session) => localStorage.setItem(SESSION_KEY, JSON.stringify(s));
export const clearSession = () => localStorage.removeItem(SESSION_KEY);
