import unittest
from datetime import datetime, timezone, timedelta
from scripts.audit_issue_board import audit

NOW = datetime(2026, 11, 20, tzinfo=timezone.utc)

def issue(number, status, state="OPEN", assignees=None, updated=None, body="Details"):
    return {
        "number": number, "state": state, "labels": [{"name": f"status:{status}"}],
        "assignees": assignees or [], "updatedAt": updated or NOW.isoformat(),
        "body": body, "url": f"https://github.com/wopee-io-demos/tazumo/issues/{number}"
    }

class BoardAuditTests(unittest.TestCase):
    def test_valid_ready_and_done(self):
        errors, warnings = audit([issue(1,"ready"),issue(2,"done","CLOSED")], "wopee-io-demos/tazumo", NOW)
        self.assertEqual((errors,warnings),([],[]))

    def test_missing_or_duplicate_status(self):
        bad = issue(1,"ready")
        bad["labels"]=[]
        multi=issue(2,"ready")
        multi["labels"].append({"name":"status:blocked"})
        errors,_=audit([bad,multi], "wopee-io-demos/tazumo", NOW)
        self.assertEqual(len(errors),2)

    def test_contradictory_state_and_claim(self):
        errors,_=audit([
            issue(1,"done"),issue(2,"ready",assignees=[{"login":"worker"}]),
            issue(3,"in-progress"),issue(4,"blocked","CLOSED")
        ],"wopee-io-demos/tazumo",NOW)
        self.assertEqual(len(errors),4)

    def test_staleness_is_warning_only(self):
        old=(NOW-timedelta(days=12)).isoformat()
        errors,warnings=audit([issue(1,"in-review",assignees=[{"login":"worker"}],updated=old)],"wopee-io-demos/tazumo",NOW)
        self.assertFalse(errors)
        self.assertEqual(len(warnings),1)

    def test_blocker_without_context_warns(self):
        errors,warnings=audit([issue(1,"blocked",body="")],"wopee-io-demos/tazumo",NOW)
        self.assertFalse(errors)
        self.assertEqual(len(warnings),1)

if __name__ == "__main__":
    unittest.main()
