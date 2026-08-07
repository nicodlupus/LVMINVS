"""
The parts of the system that are OURS and deterministic:

  encoder   — maps user text onto the clinical ontology (kNN over the CSV
              prototypes in embedding space). No generation, no guessing.
  retriever — pulls the manual passages the LLM is allowed to draw on.
  validator — re-reads the LLM's reply and rejects reassurance / certainty
              claims, the cardinal sins of this application.
"""
from __future__ import annotations

import json
import pathlib
import re

import numpy as np
from sentence_transformers import SentenceTransformer

HERE = pathlib.Path(__file__).parent
CACHE = HERE / "cache"

_model: SentenceTransformer | None = None
_corpus: list[dict] = []
_emb: np.ndarray | None = None


def load() -> None:
    global _model, _corpus, _emb
    _model = SentenceTransformer("all-MiniLM-L6-v2")
    _corpus = json.loads((CACHE / "corpus.json").read_text())
    _emb = np.load(CACHE / "embeddings.npy")


def stats() -> dict:
    onto = sum(1 for d in _corpus if d["kind"] == "ontology")
    return {"ontology_rows": onto, "manual_chunks": len(_corpus) - onto}


def _encode(text: str) -> np.ndarray:
    assert _model is not None, "pipeline.load() not called"
    return _model.encode([text], normalize_embeddings=True)[0]


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

def retrieve(text: str, k: int = 3, min_sim: float = 0.25) -> list[str]:
    """Manual passages relevant to this turn. Empty list when nothing fits —
    the renderer then has to stay with the user's own words."""
    hits = _top(_encode(text), "manual", k)
    return [h[1]["text"][:500] for h in hits if h[0] >= min_sim]


def similar_prior(text: str, prior_thoughts: list[str], min_sim: float = 0.45) -> dict | None:
    """Cross-record pattern hypothesis: is this message mechanically similar
    to a thought the user already holds? Computed HERE, not by the LLM."""
    if not prior_thoughts:
        return None
    vec = _encode(text)
    prior_emb = _model.encode(prior_thoughts, normalize_embeddings=True)
    sims = prior_emb @ vec
    i = int(np.argmax(sims))
    if float(sims[i]) < min_sim:
        return None
    s = float(sims[i])
    strength = "strong" if s > 0.7 else "recurring" if s > 0.55 else "tentative"
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
        _reassure_emb = _model.encode(_REASSURANCE_PROTOTYPES, normalize_embeddings=True)
    bad = []
    for line in lines:
        if _CERTAINTY_RE.search(line):
            bad.append(line)
            continue
        sim = float(np.max(_reassure_emb @ _encode(line)))
        if sim > 0.58:
            bad.append(line)
    return bad
