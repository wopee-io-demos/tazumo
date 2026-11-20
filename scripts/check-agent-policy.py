from pathlib import Path
r=Path(__file__).resolve().parents[1]
needed={"AGENTS.md":["docs/ENGINEERING-POLICY.md","docs/START-HERE.md"],"README.md":["docs/START-HERE.md"],"docs/ENGINEERING-POLICY.md":["status:ready","status:blocked","Refs #","OpenSpec","handoff","merge"],".github/pull_request_template.md":["Refs #","Latest pushed SHA","OpenSpec","CI"],"docs/START-HERE.md":["ISSUE-WORKFLOW.md"],"docs/ISSUE-WORKFLOW.md":["status:ready","handoff"]}
errors=[]
for path,tokens in needed.items():
 p=r/path
 if not p.is_file():errors.append(f"Missing {path}");continue
 body=p.read_text()
 errors.extend(f"{path}: missing {t}" for t in tokens if t not in body)
if errors:raise SystemExit("\n".join(errors))
print("Shared issue-first PR governance contract OK")
