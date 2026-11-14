"""Build revision CSV reports from the receiver's Submissions and Question Responses exports."""

import argparse
import csv
from collections import Counter, defaultdict
from pathlib import Path

LEVELS = ("easy", "standard", "hard")
DETAIL_FIELDS = ("Question ID", "Question Difficulty", "Selected Answer",
                 "Correct Answer", "Marks Awarded", "Marks Available", "Correct?")


def read_csv(path):
    with path.open(encoding="utf-8-sig", newline="") as source:
        return list(csv.DictReader(source))


def write_csv(path, headers, rows):
    with path.open("w", encoding="utf-8", newline="") as output:
        writer = csv.writer(output)
        writer.writerow(headers)
        for row in rows:
            writer.writerow(["'" + cell if isinstance(cell, str) and
                             cell.lstrip().startswith(("=", "+", "-", "@"))
                             else cell for cell in row])


def build_reports(submissions, responses, unit, destination):
    destination.mkdir(parents=True, exist_ok=True)
    attempts = {row["Session ID"]: row for row in submissions
                if row["Activity ID"] == unit and row.get("Submitted Successfully") == "Yes"
                and row.get("Revision Difficulty") in (*LEVELS, "progressive")}
    answers = defaultdict(dict)
    for row in responses:
        if row["Session ID"] in attempts:
            answers[row["Session ID"]][row["Question ID"]] = row

    fields = ("Session ID", "Student ID", "Class", "Activity Version",
              "Revision Difficulty", "Revision Length", "Questions Shown", "Score", "Total Marks")

    def summary(row):
        return [row.get(field, "") for field in fields]

    for level in LEVELS:
        selected = [row for row in attempts.values() if row["Revision Difficulty"] == level]
        questions = sorted({qid for row in selected for qid in answers[row["Session ID"]]},
                           key=lambda qid: (not qid[1:].isdigit(),
                                            int(qid[1:]) if qid[1:].isdigit() else qid, qid))
        question_fields = ("Selected Answer", "Correct Answer", "Marks Awarded", "Correct?")
        write_csv(destination / f"{level}.csv",
                  [*fields, *(f"{qid} {field}" for qid in questions for field in question_fields)],
                  (summary(row) + [answers[row["Session ID"]].get(qid, {}).get(field, "")
                                   for qid in questions for field in question_fields]
                   for row in selected))

    progressive = [row for row in attempts.values() if row["Revision Difficulty"] == "progressive"]
    def stage_scores(row):
        totals = {level: [0.0, 0.0] for level in LEVELS}
        for answer in answers[row["Session ID"]].values():
            level = answer.get("Question Difficulty")
            if level in totals:
                totals[level][0] += float(answer["Marks Awarded"])
                totals[level][1] += float(answer["Marks Available"])
        return [f"{earned:g}/{available:g}" if available else ""
                for earned, available in totals.values()]

    write_csv(destination / "progressive.csv", [*fields, *LEVELS],
              (summary(row) + stage_scores(row) for row in progressive))
    write_csv(destination / "question-detail.csv", [*fields, *DETAIL_FIELDS],
              (summary(row) + [answer.get(field, "") for field in DETAIL_FIELDS]
               for row in attempts.values() for answer in answers[row["Session ID"]].values()))

    totals = Counter()
    choices = Counter()
    for session_id, questions in answers.items():
        row = attempts[session_id]
        for qid, answer in questions.items():
            chosen = answer.get("Selected Answer", "")
            if not chosen:
                continue
            key = (row.get("Activity Version", ""), row["Revision Difficulty"],
                   row.get("Revision Length", ""), row.get("Class", ""), qid)
            totals[key] += 1
            choices[(*key, chosen, answer.get("Correct?", ""))] += 1
    write_csv(destination / "item-analysis.csv",
              ["Version", "Difficulty", "Length", "Class", "Question ID", "Answer",
               "Correct?", "Chosen", "Answered", "Share"],
              ((*key, count, totals[key[:5]], f"{count / totals[key[:5]]:.1%}")
               for key, count in sorted(choices.items())))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("submissions", type=Path)
    parser.add_argument("responses", type=Path)
    parser.add_argument("unit")
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    build_reports(read_csv(args.submissions), read_csv(args.responses), args.unit, args.output)
