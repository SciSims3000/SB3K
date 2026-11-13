"""Validate the SB3K catalogue and the multiple-choice activities it lists."""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read_object(path):
    with path.open(encoding="utf-8") as source:
        data = json.load(source)
    if not isinstance(data, dict):
        raise ValueError("expected a JSON object")
    return data


def required_text(data, key):
    value = data.get(key)
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{key} must be a non-empty string")
    return value


def objects(data, key, *, allow_empty=False):
    values = data.get(key)
    if (
        not isinstance(values, list)
        or (not values and not allow_empty)
        or any(not isinstance(value, dict) for value in values)
    ):
        raise ValueError(f"{key} must be an array of objects")
    return values


def validate_question(question, seen_ids):
    question_id = required_text(question, "id")
    if question_id in seen_ids:
        raise ValueError(f"duplicate question ID {question_id}")
    seen_ids.add(question_id)
    required_text(question, "question")
    if question.get("type") != "mcq":
        raise ValueError("type must be mcq")

    options = question.get("options")
    if (
        not isinstance(options, list)
        or len(options) < 2
        or any(not isinstance(option, str) or not option.strip() for option in options)
        or len(set(options)) != len(options)
    ):
        raise ValueError("options must contain at least two distinct non-empty strings")
    if required_text(question, "answer") not in options:
        raise ValueError("answer must match an option exactly")

    marks = question.get("marks")
    if type(marks) not in (int, float) or not 0 < marks < float("inf"):
        raise ValueError("marks must be a positive finite number")

    if "curriculum" in question:
        outcome_ids = set()
        for outcome in objects(question, "curriculum", allow_empty=True):
            outcome_id = required_text(outcome, "id")
            required_text(outcome, "name")
            if outcome_id in outcome_ids:
                raise ValueError(f"duplicate curriculum ID {outcome_id} on this question")
            outcome_ids.add(outcome_id)


def main():
    try:
        entries = objects(read_object(ROOT / "activities/manifest.json"), "activities")
    except (OSError, ValueError) as error:
        print(f"activities/manifest.json: {error}", file=sys.stderr)
        return 1

    errors = []
    activity_ids = set()
    for index, entry in enumerate(entries, start=1):
        label = f"manifest entry {index}"
        try:
            activity_id = required_text(entry, "id")
            if activity_id in activity_ids:
                raise ValueError(f"duplicate activity ID {activity_id}")
            activity_ids.add(activity_id)

            relative_path = required_text(entry, "path")
            label = f"{label} ({relative_path})"
            path = (ROOT / relative_path).resolve()
            if (
                not relative_path.startswith("activities/")
                or not path.is_relative_to(ROOT / "activities")
                or path.suffix != ".json"
            ):
                raise ValueError("path must point to a JSON file under activities/")

            activity = read_object(path)
            for manifest_key, activity_key in (
                ("id", "activityId"), ("title", "title"),
                ("subject", "subject"), ("yearLevel", "yearLevel"),
            ):
                if required_text(entry, manifest_key) != required_text(activity, activity_key):
                    raise ValueError(f"manifest {manifest_key} must match activity {activity_key}")
            for key in ("topic", "version", "mode"):
                required_text(activity, key)

            question_ids = set()
            for number, question in enumerate(objects(activity, "questions"), start=1):
                try:
                    validate_question(question, question_ids)
                except ValueError as error:
                    errors.append(f"{label}, question {number}: {error}")
        except (OSError, ValueError) as error:
            errors.append(f"{label}: {error}")

    if errors:
        print("\n".join(errors), file=sys.stderr)
        return 1

    print(f"Validated {len(entries)} activities.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
