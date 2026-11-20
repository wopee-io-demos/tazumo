#!/usr/bin/env python3
"""Read-only health audit of GitHub Issues, fed by gh issue list --json.

Does not mutate issues. Exit 1 on structural conflicts, 0 otherwise.
Stale issues are warnings, not proof ownership has expired.
"""
import argparse
import json
import sys
from datetime import datetime, timezone

STATES = {"backlog", "ready", "in-progress", "in-review", "blocked", "done"}
ACTIVE = {"in-progress", "in-review"}


def audit(issues, repo, now=None, stale_days=7):
    now = now or datetime.now(timezone.utc)
    errors, warnings = [], []
    for issue in issues:
        number = issue.get("number")
        url = issue.get("url") or f"https://github.com/{repo}/issues/{number}"
        raw = issue.get("labels") or []
        labels = [x.get("name") if isinstance(x, dict) else str(x) for x in raw]
        statuses = [x for x in labels if x and x.startswith("status:")]
        state = str(issue.get("state", "")).upper()
        owners = issue.get("assignees") or []
        prefix = f"#{number} {url}"
        if len(statuses) != 1:
            errors.append(f"{prefix}: expected exactly one status:* label; found {statuses}")
            continue
        status = statuses[0].split(":", 1)[1]
        if status not in STATES:
            errors.append(f"{prefix}: unknown status {status!r}")
            continue
        if status == "done" and state != "CLOSED":
            errors.append(f"{prefix}: status:done but GitHub Issue is not closed")
        if state == "CLOSED" and status != "done":
            errors.append(f"{prefix}: issue closed but status is {statuses[0]}")
        if status == "ready" and owners:
            errors.append(f"{prefix}: status:ready issue has assignee(s); claim or release it")
        if status in ACTIVE and not owners:
            errors.append(f"{prefix}: status:{status} lacks a GitHub assignee; record an owner")
        updated = issue.get("updatedAt")
        if status in ACTIVE and updated:
            try:
                date = datetime.fromisoformat(updated.replace("Z", "+00:00"))
                age_days = (now - date).total_seconds() / 86400
                if age_days >= stale_days:
                    warnings.append(f"{prefix}: no issue update for {age_days:.1f} days; review claim (not automatically abandoned)")
            except ValueError:
                warnings.append(f"{prefix}: invalid updatedAt timestamp")
        if status == "blocked" and not (issue.get("body") or "").strip():
            warnings.append(f"{prefix}: blocked issue has no body describing how to unblock")
    return errors, warnings


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", required=True)
    parser.add_argument("--stale-days", type=int, default=7)
    args = parser.parse_args()
    try:
        issues = json.load(sys.stdin)
        if not isinstance(issues, list):
            raise ValueError("Expected JSON list of GitHub Issues")
    except (ValueError, json.JSONDecodeError) as exc:
        print(f"ERROR: invalid issue JSON: {exc}", file=sys.stderr)
        return 2
    errors, warnings = audit(issues, args.repo, stale_days=args.stale_days)
    print(f"Board audit: {args.repo}; {len(issues)} issues, {len(errors)} errors, {len(warnings)} warnings")
    for e in errors:
        print("ERROR: " + e)
    for w in warnings:
        print("WARN: " + w)
    print("This report is read-only. Resolve contradictions by reviewing issue/PR history, never automatically stealing or closing tasks.")
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
