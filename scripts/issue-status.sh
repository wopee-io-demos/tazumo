#!/usr/bin/env bash
# GitHub Issue status coordination via GitHub CLI. Requires gh auth login and Issues write permission.
set -euo pipefail
usage(){ echo "Usage: bash scripts/issue-status.sh bootstrap | board | claim ISSUE | move ISSUE STATUS | handoff ISSUE FILE [ready|blocked]" >&2; exit 2; }
[[ $# -ge 1 ]] || usage
command -v gh >/dev/null || { echo "Install GitHub CLI and authenticate with gh auth login" >&2; exit 2; }
repo="$(gh repo view --json nameWithOwner --jq .nameWithOwner)"
states=(backlog ready in-progress in-review blocked done)
valid(){ for s in "${states[@]}"; do [[ "$s" == "$1" ]] && return 0; done; return 1; }
current(){ gh issue view "$1" --repo "$repo" --json labels --jq '.labels[].name' | grep '^status:' || true; }
transition(){
  local no="$1" next="$2" old
  valid "$next" || usage
  while IFS= read -r old; do [[ -z "$old" || "$old" == "status:$next" ]] || gh issue edit "$no" --repo "$repo" --remove-label "$old" >/dev/null; done < <(current "$no")
  gh issue edit "$no" --repo "$repo" --add-label "status:$next" >/dev/null
  echo "Issue #$no status:$next. Recheck ownership/assignees before editing files."
}
case "$1" in
 bootstrap)
   names=(backlog ready in-progress in-review blocked done)
   colors=(BFD4F2 0E8A16 1D76DB A371F7 D93F0B 6F7781)
   for i in "${!names[@]}"; do gh label create "status:${names[$i]}" --repo "$repo" --color "${colors[$i]}" --description "Issue workflow state: ${names[$i]}" --force; done
   echo "Status labels initialized for $repo"
   ;;
 board)
   for s in "${states[@]}"; do echo;echo "### status:$s";gh issue list --repo "$repo" --state all --label "status:$s" --limit 100 --json number,title,state,assignees,url --template '{{range .}}#{{.number}} {{.title}} [{{.state}}] {{.url}}{{"\n"}}{{end}}' || true;done
   ;;
 claim)
   [[ $# == 2 ]] || usage
   no="$2"
   [[ "$(gh issue view "$no" --repo "$repo" --json state --jq .state)" == OPEN ]] || { echo "Issue is not open" >&2; exit 1; }
   tags="$(current "$no")"
   [[ "$tags" == *"status:ready"* ]] || { echo "Issue must be status:ready. Current: $tags" >&2; exit 1; }
   count="$(gh issue view "$no" --repo "$repo" --json assignees --jq '.assignees | length')"
   [[ "$count" == "0" ]] || { echo "Issue already has assignee(s). Do not steal ownership." >&2; exit 1; }
   gh issue edit "$no" --repo "$repo" --add-assignee '@me' >/dev/null
   transition "$no" in-progress
   gh issue comment "$no" --repo "$repo" --body "Claimed for implementation. I will add a dedicated branch/PR, OpenSpec change, evidence and handoff checkpoints. Checking for competing PRs before work."
   ;;
 move)
   [[ $# == 3 ]] || usage
   transition "$2" "$3"
   ;;
 handoff)
   [[ $# == 4 ]] || usage
   [[ -f "$3" ]] || { echo "Handoff file missing" >&2; exit 2; }
   [[ "$4" == ready || "$4" == blocked ]] || usage
   gh issue comment "$2" --repo "$repo" --body-file "$3"
   transition "$2" "$4"
   gh issue edit "$2" --repo "$repo" --remove-assignee '@me' >/dev/null || true
   ;;
 *) usage ;;
esac
