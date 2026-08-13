"""
LVMINVS backend — FastAPI service the webapp talks to.

  ./.venv/bin/python ingest.py        # once, builds the embedding cache
  ./.venv/bin/uvicorn main:app --port 5055

Same contract the frontend already uses:
  POST /api/companion {history, context, mode} → {reply, chips, thought, pattern}
  GET  /api/health
"""
from __future__ import annotations

import json
import re
import time
from pathlib import Path

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

import pipeline
import policy
import renderer
import userdb

app = FastAPI(title="LVMINVS backend")
app.include_router(userdb.router)


@app.on_event("startup")
def _startup() -> None:
    pipeline.load()


class Turn(BaseModel):
    role: str
    content: str


class CompanionIn(BaseModel):
    history: list[Turn] = Field(min_length=1)
    context: str = ""
    mode: str = "home"


# the frontend serializes prior records into context lines:  - "thought" | ...
_PRIOR_RE = re.compile(r'^- "(.+?)" \|', re.M)


@app.post("/api/companion")
def companion(body: CompanionIn) -> dict:
    history = [t.model_dump() for t in body.history]
    prior = _PRIOR_RE.findall(body.context)
    t0 = time.perf_counter()
    try:
        plan = policy.build_plan(body.mode, history, prior)
        t_plan = time.perf_counter()
        data = renderer.render(plan, history)
        print(f"[companion] mode={body.mode} plan={t_plan - t0:.2f}s "
              f"llm={time.perf_counter() - t_plan:.2f}s total={time.perf_counter() - t0:.2f}s",
              flush=True)
    except Exception as exc:                       # surfaced in the UI as text
        print(f"[companion] FAILED after {time.perf_counter() - t0:.2f}s: {exc}", flush=True)
        raise HTTPException(status_code=502, detail=str(exc))
    cls = plan.classification
    data["_plan"] = {"intent": plan.intent,        # visible data-science workflow
                     "confidence": cls.get("confidence"),
                     "category": cls.get("category"),
                     "emotion": cls.get("emotion"),
                     "distortion": cls.get("distortion"),
                     "compulsion_type": cls.get("compulsion_type"),
                     "evidence_used": len(plan.evidence)}
    return data


class FeedbackIn(BaseModel):
    rating: int = Field(ge=1, le=5)
    recommendation: str = Field(default="", max_length=2000)
    reply: str = Field(default="", max_length=4000)
    ts: str = Field(default="", max_length=64)


FEEDBACK_LOG = Path(__file__).with_name("feedback.jsonl")


@app.post("/api/feedback")
def feedback(body: FeedbackIn) -> dict:
    """Append a per-reply rating to feedback.jsonl.

    Deliberately anonymous: the endpoint takes no username, no auth key
    and no prior message text. The stored row is exactly what the user
    consented to send — a rating, an optional note, and the reply that
    the rating is about — so later training / policy work can associate
    a score with a specific generated response without ever touching the
    user's own writing.
    """
    row = {
        "rating": body.rating,
        "recommendation": body.recommendation.strip(),
        "reply": body.reply,
        "ts": body.ts or time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    try:
        with FEEDBACK_LOG.open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(row, ensure_ascii=False) + "\n")
    except OSError as exc:
        raise HTTPException(status_code=500, detail=f"could not persist feedback: {exc}")
    return {"ok": True}


class ClassificationVerdictIn(BaseModel):
    verdict: str = Field(pattern=r"^(correct|off)$")
    correction: str = Field(default="", max_length=500)
    reply: str = Field(default="", max_length=4000)
    classification: dict = Field(default_factory=dict)
    ts: str = Field(default="", max_length=64)


CLASS_FEEDBACK_LOG = Path(__file__).with_name("classification_feedback.jsonl")


@app.post("/api/classification-feedback")
def classification_feedback(body: ClassificationVerdictIn) -> dict:
    """Log whether the encoder's read of the user's discomfort was correct.

    This is the training signal for improving the classifier and, later, the
    fine-tuned policy that replaces the rule-based one. Anonymous by design:
    no username, no prior message text. We store what the model claimed
    (category / emotion / etc.), what the user said back ('correct' or 'off'),
    and — when off — the user's short correction.
    """
    allowed = {"category", "emotion", "distortion", "compulsion_type", "confidence"}
    row = {
        "verdict": body.verdict,
        "correction": body.correction.strip(),
        "reply": body.reply,
        "classification": {k: v for k, v in body.classification.items() if k in allowed},
        "ts": body.ts or time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    try:
        with CLASS_FEEDBACK_LOG.open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(row, ensure_ascii=False) + "\n")
    except OSError as exc:
        raise HTTPException(status_code=500, detail=f"could not persist verdict: {exc}")
    return {"ok": True}


@app.get("/api/health")
def health() -> dict:
    return {"ok": True, "model": renderer.MODEL, **pipeline.stats()}
