# 🤖 Codex Agent Instructions for Terna Task Execution

## 🎯 Core Purpose
You are Codex, a cloud-based software engineering agent. When instructed to work on a specific issue (e.g., "work on issue-011-whatever"), you must navigate to the `/terna` folder structure and execute tasks following this precise workflow.

---

## 📂 Critical Folder Structure

```
/terna/
└── projects/
    └── <project-name>/
        ├── project.md                    # Project overview
        └── issues/
            └── <issue-id>/
                ├── issue.md              # Task requirements (source of truth)
                ├── attempts/             # Your work logs go here
                │   ├── attempt-1.md
                │   └── attempt-N.md
                └── sub-issues/           # Optional child tasks
                    └── <sub-issue-id>.md
```

### ⚠️ IMPORTANT RULES:
1. **Always work within `/terna` directory** - This is where all task tracking lives
2. **Never modify the main codebase structure** - Only work on assigned issues
3. **Document everything in attempt files** - This is mandatory for every task

---

## 🔄 Task Execution Workflow (MUST FOLLOW)

### 1️⃣ Task Discovery
When user says "work on issue-XXX":
1. Navigate to `/terna/projects/`
2. Search for the issue folder matching the pattern
3. Read `issue.md` to understand requirements

```bash
# Example navigation
cd /terna/projects/
find . -name "*issue-XXX*" -type d
cd <found-issue-directory>
cat issue.md
```

### 2️⃣ Create Attempt Log (MANDATORY)
Before starting ANY work:

```bash
# Check existing attempts
ls attempts/
# Create new attempt file
touch attempts/attempt-N.md
```

Use this EXACT template for attempt files:

```yaml
---
attempt: <N>
agent: codex
started: "<ISO-8601 timestamp>"
status: in_progress
---

# Attempt N: <Issue Title>

## What I'm trying
[List specific steps you plan to take]

## Work log
[Document actions as you perform them]

## Files changed
[Track all modifications]

## Results
[Document outcomes]
```

### 3️⃣ Execute the Task
1. **Read requirements** from `issue.md`
2. **Navigate to main codebase** (parent directories outside `/terna`)
3. **Implement changes** according to requirements
4. **Test thoroughly** using project's test suite
5. **Update attempt file** continuously as you work

### 4️⃣ Complete the Task
On successful completion:

```yaml
---
attempt: <N>
agent: codex
started: "<start-time>"
completed: "<end-time>"
status: success
issue_status: in_review  # This triggers status update
---

# Final summary of successful implementation
```

On failure:

```yaml
---
attempt: <N>
agent: codex
started: "<start-time>"
completed: "<end-time>"
status: failed
---

# Document what went wrong and why
```

---

## 📋 Issue File Format

Every `issue.md` contains:

```yaml
---
id: ISSUE-XXX
title: <descriptive title>
status: todo | in_progress | in_review | done | blocked
assignee: agent-codex  # When this is set, you should work on it
priority: high | medium | low
parent: null | <parent-issue-id>
---

# Issue Description

## Requirements
[What needs to be done]

## Definition of Done
- [ ] Checklist items that must be completed
- [ ] Tests pass
- [ ] Code reviewed
```

---

## 🛠️ Command Reference

### Navigation Commands
```bash
# Always start here
cd /terna/projects/

# Find specific issue
find . -name "*issue-XXX*" -type d

# Read issue details
cat <issue-path>/issue.md

# Check existing attempts
ls <issue-path>/attempts/
```

### Testing Commands (use based on project)
```bash
# Node.js projects
pnpm test
npm test

# Python projects
pytest
make test

# General
make test
./scripts/test.sh
```

---

## ✅ Definition of Done Checklist

Before marking any task as complete:

1. **Code Implementation**
   - [ ] All requirements from `issue.md` implemented
   - [ ] Code follows project conventions
   - [ ] No hardcoded values or credentials

2. **Testing**
   - [ ] All existing tests pass
   - [ ] New tests added for new functionality
   - [ ] Linting/type-checking passes

3. **Documentation**
   - [ ] Attempt file fully documented
   - [ ] All changes listed in attempt file
   - [ ] Success/failure status set correctly

4. **Status Update**
   - [ ] Set `issue_status: in_review` in attempt file
   - [ ] Commit all changes
   - [ ] Create PR if applicable

---

## 🚨 Critical Reminders

1. **ALWAYS create attempt files** - No exceptions
2. **NEVER skip the `/terna` structure** - This is how we track your work
3. **Document continuously** - Update attempt file as you work, not just at the end
4. **Test everything** - A task isn't done until tests pass
5. **Read the full issue** - Don't assume, read all requirements

---

## 💡 Example Workflow

User: "Work on issue-011-protect-routes"

```bash
# 1. Navigate to terna
cd /terna/projects/

# 2. Find the issue
find . -name "*issue-011*" -type d
# Output: ./project-1-name/issues/issue-011-protect-routes/

# 3. Read the issue
cd project-1-name/issues/issue-011-protect-routes/
cat issue.md

# 4. Create attempt log
mkdir -p attempts
echo "---
attempt: 1
agent: codex
started: \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
status: in_progress
---

# Attempt 1: Protect Routes

## What I'm trying
- Implement route protection as specified
- Add authentication checks
- Test all protected endpoints

## Work log
[Starting implementation...]" > attempts/attempt-1.md

# 5. Navigate to main codebase and implement
cd /Users/nfugallo/terna  # Or wherever the main code is
# ... implement changes ...

# 6. Update attempt file with results
# 7. Set final status in attempt file
# 8. Run the Linear sync script
python scripts/sync_to_linear.py "issue-011-protect-routes"

## 🔗 Integration Notes
- Attempt files are your work diary - treat them as mandatory
- Status changes in attempt files can trigger external syncs (e.g., to Linear)
- **The Linear sync script MUST be run after every successful task completion.**

Remember: You're not just coding, you're participating in a structured workflow that tracks and documents every action. Follow this guide precisely for successful task execution. 
