#!/usr/bin/env python3
"""Lightweight regression checks for GH-300 exam simulator logic.

Checks:
- questions.json structure and duplicate stats
- domain target distribution sums
- recent-repeat avoidance behavior with fallback
"""

from __future__ import annotations

import json
from pathlib import Path

DOMAIN_TARGETS = {
    "responsibleUse": 17.5,
    "useCopilotFeatures": 27.5,
    "copilotFeatures": 27.5,
    "dataArchitecture": 12.5,
    "promptEngineering": 12.5,
    "productivity": 12.5,
    "privacySafeguards": 12.5,
}


def normalize_text(value: str) -> str:
    return " ".join((value or "").lower().split())


def get_fingerprint(question: dict) -> str:
    normalized_question = normalize_text(question.get("text", ""))
    option_text = sorted(normalize_text(option.get("text", "")) for option in question.get("options", []))
    return f"{normalized_question}::{'||'.join(option_text)}"


def build_unique_pool(questions: list[dict]) -> list[dict]:
    seen_ids: set[str] = set()
    seen_fp: set[str] = set()
    unique: list[dict] = []

    for question in questions:
        qid = str(question.get("id", ""))
        if not qid:
            continue
        fp = get_fingerprint(question)
        if qid in seen_ids or fp in seen_fp:
            continue
        seen_ids.add(qid)
        seen_fp.add(fp)
        unique.append(question)

    return unique


def compute_domain_targets(total_count: int, weight_map: dict[str, float]) -> dict[str, int]:
    entries = list(weight_map.items())
    weight_total = sum(weight for _, weight in entries)
    rows: list[dict] = []

    for key, weight in entries:
        exact = (weight / weight_total) * total_count if weight_total > 0 else 0
        floor = int(exact)
        rows.append({"key": key, "exact": exact, "floor": floor, "remainder": exact - floor})

    targets = {row["key"]: row["floor"] for row in rows}
    assigned = sum(targets.values())

    for row in sorted(rows, key=lambda r: r["remainder"], reverse=True):
        if assigned >= total_count:
            break
        targets[row["key"]] += 1
        assigned += 1

    return targets


def get_recent_question_ids(history: list[dict], exam_window: int) -> set[str]:
    recent: set[str] = set()
    for entry in history[: max(0, exam_window)]:
        for qid in entry.get("questionIds", []):
            recent.add(str(qid))
    return recent


def simulate_pool_selection(unique_pool: list[dict], history: list[dict], question_count: int, window: int) -> tuple[int, int, bool]:
    recent_ids = get_recent_question_ids(history, window)
    unseen = [q for q in unique_pool if str(q["id"]) not in recent_ids]
    selected_count = min(question_count, len(unique_pool))
    used_fallback = len(unseen) < selected_count
    pool = unique_pool if used_fallback else unseen
    return len(unseen), len(pool), used_fallback


def main() -> int:
    repo_root = Path(__file__).resolve().parents[1]
    questions_file = repo_root / "docs" / "questions.json"

    if not questions_file.exists():
        print("FAIL: docs/questions.json not found")
        return 1

    payload = json.loads(questions_file.read_text(encoding="utf-8"))
    questions = payload.get("questions", [])

    if not isinstance(questions, list) or not questions:
        print("FAIL: questions payload missing or empty")
        return 1

    unique_pool = build_unique_pool(questions)

    by_id = len({str(q.get("id", "")) for q in questions if q.get("id") is not None})
    by_fp = len({get_fingerprint(q) for q in questions})

    print("Question bank stats")
    print(f"- total: {len(questions)}")
    print(f"- unique by id: {by_id}")
    print(f"- unique by content fingerprint: {by_fp}")
    print(f"- unique pool used by simulator: {len(unique_pool)}")

    for total in (30, 65, 90):
        targets = compute_domain_targets(total, DOMAIN_TARGETS)
        if sum(targets.values()) != total:
            print(f"FAIL: domain target sum mismatch for {total}")
            return 1
    print("PASS: domain target distribution sums are correct for 30/65/90")

    mock_history = [
        {"questionIds": [str(i) for i in range(1, 66)]},
        {"questionIds": [str(i) for i in range(66, 131)]},
        {"questionIds": [str(i) for i in range(131, 196)]},
    ]

    unseen_count, pool_count, used_fallback = simulate_pool_selection(unique_pool, mock_history, 65, 3)
    if unseen_count >= 65 and used_fallback:
        print("FAIL: fallback triggered unexpectedly when unseen pool was sufficient")
        return 1

    forced_fallback_history = [{"questionIds": [str(q["id"]) for q in unique_pool]}]
    unseen_count_2, pool_count_2, used_fallback_2 = simulate_pool_selection(unique_pool, forced_fallback_history, 65, 1)
    if not used_fallback_2:
        print("FAIL: fallback did not trigger when unseen pool was exhausted")
        return 1

    print("PASS: repeat-avoidance fallback behavior is correct")
    print("All regression checks passed")
    print(f"(sample run details: unseen={unseen_count}, pool={pool_count}, forced unseen={unseen_count_2}, forced pool={pool_count_2})")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
