"""
LVMINVS backend — FastAPI service the webapp talks to.

  ./.venv/bin/python ingest.py        # once, builds the embedding cache
  ./.venv/bin/uvicorn main:app --port 5055

Same contract the frontend already uses:
  POST /api/companion {history, context, mode} → {reply, chips, thought, pattern}
  GET  /api/health
"""
from __future__ import annotations

import re
import time

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


@app.get("/api/health")
def health() -> dict:
    return {"ok": True, "model": renderer.MODEL, **pipeline.stats()}
