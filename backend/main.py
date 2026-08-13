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
    data["_plan"] = {"intent": plan.intent,        # visible data-science workflow
                     "confidence": plan.classification.get("confidence"),
                     "category": plan.classification.get("category"),
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


@app.get("/api/health")
def health() -> dict:
    return {"ok": True, "model": renderer.MODEL, **pipeline.stats()}
