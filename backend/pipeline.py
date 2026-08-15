"""
The parts of the system that are OURS and deterministic:

  encoder   — maps user text onto the clinical ontology (kNN over the CSV
              prototypes in embedding space). No generation, no guessing.
  retriever — pulls the manual passages the LLM is allowed to draw on.
  validator — re-reads the LLM's reply and rejects reassurance / certainty
              claims, the cardinal sins of this application.

Vectors are produced by OpenAI's text-embedding-3-small — a deployment
choice, not an architectural one. The classifier, retriever and validator
that consume those vectors are still fully ours: kNN over the CSV
prototypes, cosine gates in code, regex + prototype-similarity for the
validator. Nothing about "the model doesn't decide" changes; the encoder
just no longer needs 500 MB of PyTorch resident in RAM.
"""
from __future__ import annotations

import json
import os
import pathlib
import re
from functools import lru_cache

import numpy as np
from dotenv import load_dotenv
from openai import OpenAI

HERE = pathlib.Path(__file__).parent
load_dotenv(HERE / ".env")

CACHE = HERE / "cache"
EMBED_MODEL = os.getenv("EMBED_MODEL", "text-embedding-3-small")

_client: OpenAI | None = None
_corpus: list[dict] = []
_emb: np.ndarray | None = None


def load() -> None:
    global _client, _corpus, _emb
    _client = OpenAI()
    _corpus = json.loads((CACHE / "corpus.json").read_text())
    _emb = np.load(CACHE / "embeddings.npy")


def stats() -> dict:
    onto = sum(1 for d in _corpus if d["kind"] == "ontology")
    return {"ontology_rows": onto, "manual_chunks": len(_corpus) - onto,
            "embed_model": EMBED_MODEL}


def _embed(texts: list[str]) -> np.ndarray:
    """Batched embedding call. Returns L2-normalised vectors so a dot
    product equals cosine similarity — same contract as the old MiniLM
    path, drop-in for every caller downstream."""
    assert _client is not None, "pipeline.load() not called"
    resp = _client.embeddings.create(model=EMBED_MODEL, input=texts)
    v = np.array([d.embedding for d in resp.data], dtype=np.float32)
    norms = np.linalg.norm(v, axis=1, keepdims=True)
    return v / np.maximum(norms, 1e-12)


@lru_cache(maxsize=128)
def _encode(text: str) -> np.ndarray:
    """One text → one vector. Cached because classify/retrieve/similar_prior
    all hit the same user message in a single turn — one API call instead
    of three."""
    return _embed([text])[0]


def _top(vec: np.ndarray, kind: str, k: int) -> list[tuple[float, dict]]:
    idx = [i for i, d in enumerate(_corpus) if d["kind"] == kind]
    sims = _emb[idx] @ vec
    order = np.argsort(-sims)[:k]
    return [(float(sims[o]), _corpus[idx[o]]) for o in order]


# ── encoder ──────────────────────────────────────────────────────────────

def classify(text: str, k: int = 3) -> dict:
    """User text → nearest ontology rows. Confidence is the top cosine sim."""
    hits = _top(_encode(text), "ontology", k)
    best = hits[0]
    return {
        "confidence": round(best[0], 3),
        "category": best[1]["category"],
        "emotion": best[1]["emotion"],
        "distortion": best[1]["distortion"],
        "compulsion_type": best[1]["compulsion_type"],
        "alternatives": [{"category": h[1]["category"], "sim": round(h[0], 3)}
                         for h in hits[1:]],
    }


# ── retriever ────────────────────────────────────────────────────────────

def retrieve(text: str, k: int = 3, min_sim: float = 0.35) -> list[str]:
    """Manual passages relevant to this turn. Empty list when nothing fits —
    the renderer then has to stay with the user's own words."""
    hits = _top(_encode(text), "manual", k)
    return [h[1]["text"][:500] for h in hits if h[0] >= min_sim]


def similar_prior(text: str, prior_thoughts: list[str], min_sim: float = 0.55) -> dict | None:
    """Cross-record pattern hypothesis: is this message mechanically similar
    to a thought the user already holds? Computed HERE, not by the LLM."""
    if not prior_thoughts:
        return None
    combined = _embed([text] + prior_thoughts)     # one call for text + priors
    vec, prior_emb = combined[0], combined[1:]
    sims = prior_emb @ vec
    i = int(np.argmax(sims))
    if float(sims[i]) < min_sim:
        return None
    s = float(sims[i])
    strength = "strong" if s > 0.78 else "recurring" if s > 0.65 else "tentative"
    return {"prior": prior_thoughts[i], "sim": round(s, 3), "strength": strength}


# ── validator ────────────────────────────────────────────────────────────

_REASSURANCE_PROTOTYPES = [
    "Don't worry, everything will be fine.",
    "Nothing bad is going to happen to you.",
    "That outcome is very unlikely, you are safe.",
    "I'm sure you locked the door, there is no danger.",
    "You definitely don't need to check again.",
]
_reassure_emb: np.ndarray | None = None

_CERTAINTY_RE = re.compile(
    r"\b(\d{1,3}\s?%|guarantee|definitely (?:won't|will not)|no chance|"
    r"impossible that|you are safe|nothing (?:bad )?will happen|"
    r"do(?:n't| not) worry|(?:very|highly) unlikely|won't happen|"
    r"everything (?:will|is going to) be (?:fine|okay|ok|alright))\b", re.I)


def check_reply(lines: list[str]) -> list[str]:
    """Return the offending lines (empty list = clean)."""
    global _reassure_emb
    if _reassure_emb is None:
        _reassure_emb = _embed(_REASSURANCE_PROTOTYPES)
    bad: list[str] = []
    to_embed: list[str] = []
    for line in lines:
        if _CERTAINTY_RE.search(line):
            bad.append(line)                       # regex hit, no API call needed
        else:
            to_embed.append(line)
    if not to_embed:
        return bad
    line_emb = _embed(to_embed)                    # one batch call for the rest
    for line, emb in zip(to_embed, line_emb):
        sim = float(np.max(_reassure_emb @ emb))
        if sim > 0.70:
            bad.append(line)
    return bad
