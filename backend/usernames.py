"""Random usernames: neutral, memorable, nothing personal to leak."""
import secrets

ADJ = ["amber", "cedar", "quiet", "misty", "violet", "iron", "salt", "pale",
       "brisk", "vast", "mild", "deep", "plain", "swift", "dusk", "early"]
NOUN = ["otter", "harbor", "meadow", "lantern", "spruce", "ridge", "willow",
        "comet", "anchor", "heron", "atlas", "ember", "fjord", "quill"]


def random_username() -> str:
    return f"{secrets.choice(ADJ)}-{secrets.choice(NOUN)}-{secrets.randbelow(90) + 10}"
