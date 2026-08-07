"""
Deterministic policy: state → InstructionPlan.

The LLM never chooses what to do. This module does, from:
  - the active feature (mode)
  - how deep into the conversation we are (turn count)
  - what the encoder saw in the user's message
  - whether a cross-record similarity exists

The plan is the ONLY instruction the LLM receives about content.
"""
from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field

import pipeline

Intent = Literal["validate", "ask_one_question", "name_mechanism",
                 "offer_exercise", "extract_record", "close_loop"]

FORBIDDEN = [
    "reassurance in any form",
    "diagnosis or clinical labels applied to the user",
    "probability or certainty claims about feared outcomes",
    "opening new topics the user did not raise",
    "more than one question",
]


class PatternHint(BaseModel):
    prior: str
    strength: Literal["tentative", "recurring", "strong"]


class InstructionPlan(BaseModel):
    intent: Intent
    mode: str
    classification: dict                     # encoder output, for vocabulary only
    evidence: list[str] = Field(default_factory=list)   # manual passages allowed
    question_topic: Optional[str] = None     # what the single question must be about
    pattern_hint: Optional[PatternHint] = None
    allow_thought_extraction: bool = False
    max_sentences: int = 3
    forbidden: list[str] = Field(default_factory=lambda: list(FORBIDDEN))


# per-mode question ladders — the bounded shape of each feature
_LADDER = {
    "home":    ["the specific incident behind this, when and where",
                "the emotion underneath it",
                "what they felt they had to do"],
    "reflect": ["what was happening just before the thought arrived",
                "the emotion underneath it",
                "what it felt like they had to do",
                "whether this reminds them of another recorded situation"],
}


def build_plan(mode: str, history: list[dict], prior_thoughts: list[str]) -> InstructionPlan:
    user_msgs = [m["content"] for m in history if m.get("role") == "user"]
    text = user_msgs[-1] if user_msgs else ""
    turn = len(user_msgs)

    cls = pipeline.classify(text) if text.strip() else {"confidence": 0.0}
    evidence = pipeline.retrieve(text) if text.strip() else []
    sim = pipeline.similar_prior(text, prior_thoughts)
    hint = PatternHint(prior=sim["prior"], strength=sim["strength"]) if sim else None

    if mode == "capture":
        return InstructionPlan(
            intent="extract_record", mode=mode, classification=cls,
            evidence=evidence, allow_thought_extraction=True,
            pattern_hint=hint, max_sentences=2)

    ladder = _LADDER.get(mode, _LADDER["home"])

    # bounded conversations: walk the ladder, then name what was seen, then close
    if turn <= len(ladder):
        intent: Intent = "validate" if turn == 1 else "ask_one_question"
        topic = ladder[turn - 1]
        # a confident match lets us name the mechanism instead of a generic step
        if turn > 1 and cls.get("confidence", 0) > 0.55:
            intent = "name_mechanism"
    elif turn == len(ladder) + 1:
        intent, topic = "name_mechanism", None
    elif mode == "reflect":
        intent, topic = "close_loop", None
    else:
        intent, topic = "offer_exercise", None

    return InstructionPlan(
        intent=intent, mode=mode, classification=cls, evidence=evidence,
        question_topic=topic if intent in ("validate", "ask_one_question") else None,
        pattern_hint=hint,
        # a thought may only enter the map once the user has given the thought
        # itself plus some surrounding structure — mirrors the old contract
        allow_thought_extraction=turn >= 2 and cls.get("confidence", 0) > 0.35,
    )
