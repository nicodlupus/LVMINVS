"""
The OpenAI call. The model is a language surface, not a decision maker:
it receives an InstructionPlan and must verbalize exactly that — same JSON
contract the frontend already consumes ({reply, chips, thought, pattern}).
"""
from __future__ import annotations

import json
import os
import pathlib

from dotenv import load_dotenv
from openai import OpenAI

import pipeline
from policy import InstructionPlan

HERE = pathlib.Path(__file__).parent
load_dotenv(HERE.parent / "ocd_prototype_app_example" / ".env")   # reuse existing key

client = OpenAI()
MODEL = os.getenv("OCD_MODEL", "gpt-4o-mini")
MODEL_FALLBACK = os.getenv("OCD_MODEL_FALLBACK", "gpt-4o-mini")

RENDER_PROMPT = """You are the language surface of a structured system inside an
application that helps people notice compulsions and overthinking and understand
themselves. You do NOT decide what happens in the conversation — an upstream
policy already has. You receive an InstructionPlan JSON and you verbalize it,
warmly and plainly, in second person.

The plan's fields:
- intent: the ONLY move you may make this turn.
    validate           → acknowledge what was said, no question.
    ask_one_question   → ask exactly one question, about question_topic.
    name_mechanism     → describe the mechanism the classification names
                         (e.g. checking, mental reviewing) as an observation,
                         never as a label on the person.
    offer_exercise     → offer the app's Trigger Exercise for this situation.
    extract_record     → acknowledge the capture in one short line.
    close_loop         → wind the reflection down; point to the MindMap.
- classification: vocabulary you may use (category, emotion, compulsion_type).
- evidence: the only background passages you may draw on. If empty, use only
  the user's own words.
- pattern_hint: if present, mention that this may connect to the prior thought
  given, phrased strictly as a hypothesis for the user to accept or reject.
- forbidden: absolute. Reassurance, diagnosis, certainty and probability claims
  about feared outcomes are never allowed, in any wording.
- max_sentences: hard cap across all reply strings.

Output a single JSON object, no markdown fence:
{
  "reply": ["1-2 short conversational messages"],
  "chips": ["up to 3 very short suggested user answers"],
  "thought": null or {"thought": "...", "category": "...", "trigger": "...",
              "emotion": "...", "compulsion": "...", "intensity": 1-10,
              "note": "one sentence"},
  "pattern": null or {"basis": "shared mechanism as a hypothesis",
              "strength": "tentative"|"recurring"|"strong"}
}
- "thought" only when the plan sets allow_thought_extraction AND the user's own
  words contain the thought. Use the user's wording. Otherwise null.
- "pattern" only when pattern_hint is present. Otherwise null.
"""

FALLBACK_LINE = ("Let's stay with what you observed, without settling whether "
                 "the fear itself is true.")


def _call(model: str, plan: InstructionPlan, history: list[dict]) -> dict:
    resp = client.chat.completions.create(
        model=model,
        temperature=0.4,
        response_format={"type": "json_object"},
        store=False,   # sensitive mental-health content — never retained upstream
        messages=[
            {"role": "system", "content": RENDER_PROMPT},
            {"role": "system", "content": "INSTRUCTION PLAN:\n" + plan.model_dump_json(indent=1)},
            *history[-8:],          # recent turns only, for tone and pronouns
        ],
    )
    return json.loads(resp.choices[0].message.content)


def render(plan: InstructionPlan, history: list[dict]) -> dict:
    try:
        data = _call(MODEL, plan, history)
    except Exception:
        data = _call(MODEL_FALLBACK, plan, history)

    # normalize to the UI contract
    data.setdefault("reply", [])
    data.setdefault("chips", [])
    data.setdefault("thought", None)
    data.setdefault("pattern", None)
    if isinstance(data["reply"], str):
        data["reply"] = [data["reply"]]

    # hard gates OUR side, regardless of what the model emitted
    if not plan.allow_thought_extraction:
        data["thought"] = None
    if plan.pattern_hint is None:
        data["pattern"] = None
    else:
        # strength is ours (cosine similarity), and a lazy/echoed basis gets
        # replaced by a deterministic one built from the encoder's vocabulary
        basis = (data.get("pattern") or {}).get("basis", "")
        if len(basis) < 25 or "shared mechanism" in basis.lower():
            mech = plan.classification.get("compulsion_type", "a similar response")
            basis = (f"This may run on the same mechanism as “{plan.pattern_hint.prior}” "
                     f"— {mech.lower()}. A hypothesis for you to accept or reject.")
        data["pattern"] = {"basis": basis, "strength": plan.pattern_hint.strength}

    # validator: strip reassurance / certainty lines; regenerate once if all died
    bad = pipeline.check_reply(data["reply"])
    if bad:
        data["reply"] = [l for l in data["reply"] if l not in bad] or [FALLBACK_LINE]
        data["_validator"] = {"removed": len(bad)}

    # the plan demanded one question — if the model skipped it, WE ask it
    if plan.intent == "ask_one_question" and plan.question_topic \
            and not any("?" in l for l in data["reply"]):
        data["reply"].append(f"Could you say something about {plan.question_topic}?")
    return data
