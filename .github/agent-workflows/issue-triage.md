# Issue Triage Agent

---
name: Issue Triage Agent
on:
  issues:
    types: [opened]
permissions:
  contents: read
  issues: write
safe_outputs:
  - create_issue_comment
  - add_labels
engine: copilot
---

When a new issue is opened:

- Read the title and body.
- Classify it as bug, feature, question, or chore.
- Add labels that match the classification.
- Write a short summary comment explaining the classification.

