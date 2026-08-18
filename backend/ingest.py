"""
Preprocessing: build the knowledge the pipeline is contained by.

Sources
  1. test_data.csv         — clinician-authored ontology rows (categories,
                             triggers, distortions, compulsions, resistance)
  2. *.pdf in the project  — the OCD manuals / presentations. Chunked and
                             embedded; the LLM may only draw on these passages.

Output: backend/cache/corpus.json + embeddings.npy
Run once (and re-run whenever a source changes):
  ./.venv/bin/python ingest.py

Vectors come from OpenAI's text-embedding-3-small — matches pipeline.py so
the same vector space is used at ingest and at query time. Needs
OPENAI_API_KEY set at build time.
"""
from __future__ import annotations

import csv
import json
import os
import pathlib

import numpy as np
from dotenv import load_dotenv
from openai import OpenAI
from pypdf import PdfReader

HERE = pathlib.Path(__file__).parent
load_dotenv(HERE / ".env")
ROOT = HERE.parent
CACHE = HERE / "cache"
CSV_PATH = ROOT / "ocd_prototype_app_example" / "test_data.csv"
PDF_PATHS = [ROOT / "ocd_1stp.pdf", ROOT / "OCD_Support_Tool_Concept.pdf"]

EMBED_MODEL = os.getenv("EMBED_MODEL", "text-embedding-3-small")

CHUNK_CHARS = 700
OVERLAP = 120
BATCH = 96


def load_ontology_rows() -> list[dict]:
    """Each CSV row becomes both a retrievable document and a class prototype."""
    rows = []
    with CSV_PATH.open(encoding="utf-8-sig", newline="") as fh:
        for r in csv.DictReader(fh):
            rows.append({
                "kind": "ontology",
                "id": f"csv_{r['id']}",
                "category": r["category"],
                "trigger": r["trigger"],
                "emotion": r["emotion"],
                "distortion": r["cognitive_distortion"],
                "compulsion": r["compulsion"],
                "compulsion_type": r["compulsion_type"],
                "discomfort": r["discomfort_level"],
                "resistance": r["resistance_level"],
                # the text that gets embedded — what a user's message should match
                "text": f"{r['trigger']}. {r['intrusive_thought']}. {r['compulsion']}",
            })
    return rows


def chunk(text: str) -> list[str]:
    out, i = [], 0
    while i < len(text):
        piece = text[i:i + CHUNK_CHARS].strip()
        if len(piece) > 80:                       # skip near-empty fragments
            out.append(piece)
        i += CHUNK_CHARS - OVERLAP
    return out


def load_manual_chunks() -> list[dict]:
    docs = []
    for path in PDF_PATHS:
        if not path.exists():
            print(f"  ! missing {path.name}, skipped")
            continue
        text = " ".join((page.extract_text() or "") for page in PdfReader(path).pages)
        text = " ".join(text.split())              # collapse whitespace
        for j, piece in enumerate(chunk(text)):
            docs.append({"kind": "manual", "id": f"{path.stem}_{j}",
                         "source": path.name, "text": piece})
        print(f"  · {path.name}: {len([d for d in docs if d.get('source') == path.name])} chunks")
    return docs


def embed_all(client: OpenAI, texts: list[str]) -> np.ndarray:
    """Batched — OpenAI accepts up to 2048 inputs per call, we stay well
    under that. L2-normalise so dot product == cosine similarity."""
    out: list[list[float]] = []
    for i in range(0, len(texts), BATCH):
        batch = texts[i:i + BATCH]
        resp = client.embeddings.create(model=EMBED_MODEL, input=batch)
        out.extend([d.embedding for d in resp.data])
        print(f"  embedded {min(i + BATCH, len(texts))}/{len(texts)}")
    v = np.array(out, dtype=np.float32)
    norms = np.linalg.norm(v, axis=1, keepdims=True)
    return v / np.maximum(norms, 1e-12)


def main() -> None:
    CACHE.mkdir(exist_ok=True)
    corpus = load_ontology_rows() + load_manual_chunks()
    print(f"embedding {len(corpus)} documents with {EMBED_MODEL} …")
    client = OpenAI()
    emb = embed_all(client, [d["text"] for d in corpus])
    np.save(CACHE / "embeddings.npy", emb)
    (CACHE / "corpus.json").write_text(json.dumps(corpus, ensure_ascii=False, indent=1))
    print(f"done → {CACHE}/corpus.json ({len(corpus)} docs), embeddings {emb.shape}")


if __name__ == "__main__":
    main()
