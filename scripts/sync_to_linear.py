import os
import re
import argparse
from pathlib import Path
import yaml
import requests
from dotenv import load_dotenv

# --- Configuration ---
load_dotenv()
TERNA_DIR = Path(os.getenv("TERNA_ROOT", "terna"))
PROJECTS_DIR = TERNA_DIR / "projects"
LINEAR_API_KEY = os.getenv("LINEAR_API_KEY")
LINEAR_API_URL = "https://api.linear.app/graphql"

if not LINEAR_API_KEY:
    print("❌ ERROR: LINEAR_API_KEY environment variable not set.")
    print("Please create a .env file in the root of the project and add LINEAR_API_KEY=<your_key>")
    exit(1)

# --- Helper Functions ---

def find_issue_path(issue_id_prefix: str) -> Path | None:
    """Finds the path to an issue directory based on its ID prefix."""
    for project_dir in PROJECTS_DIR.iterdir():
        if not project_dir.is_dir():
            continue
        issues_dir = project_dir / "issues"
        if not issues_dir.exists():
            continue
        for issue_dir in issues_dir.iterdir():
            if issue_dir.name.startswith(issue_id_prefix):
                return issue_dir
    return None

def get_latest_attempt(issue_path: Path) -> Path | None:
    """Gets the most recent attempt file from an issue's attempts directory."""
    attempts_dir = issue_path / "attempts"
    if not attempts_dir.exists():
        return None
    
    attempts = sorted(
        attempts_dir.glob("attempt-*.md"),
        key=lambda f: int(re.search(r"attempt-(\d+)\.md", f.name).group(1)),
        reverse=True,
    )
    return attempts[0] if attempts else None

def format_attempt_for_linear(attempt_path: Path, issue_id: str) -> str:
    """Formats an attempt file into a Markdown comment for Linear."""
    with open(attempt_path, "r") as f:
        content = f.read()
    
    # Separate frontmatter from markdown body
    parts = content.split("---", 2)
    frontmatter = yaml.safe_load(parts[1])
    body = parts[2].strip()

    status_emoji = "✅" if frontmatter.get("status") == "success" else "❌"
    
    comment = f"### {status_emoji} Agent Attempt #{frontmatter.get('attempt')} Report ({frontmatter.get('agent')})\n\n"
    comment += f"**Task:** `{issue_id}`\n"
    comment += f"**Status:** `{frontmatter.get('status', 'N/A')}`\n"
    comment += f"**Started:** `{frontmatter.get('started', 'N/A')}`\n"
    comment += f"**Completed:** `{frontmatter.get('completed', 'N/A')}`\n\n"
    comment += "---\n\n"
    comment += body

    return comment

def post_comment_to_linear(issue_id: str, comment_body: str):
    """Posts a comment to a Linear issue."""
    headers = {"Authorization": LINEAR_API_KEY, "Content-Type": "application/json"}
    query = """
        mutation CreateComment($issueId: String!, $body: String!) {
          commentCreate(input: {issueId: $issueId, body: $body}) {
            success
            comment {
              id
              body
            }
          }
        }
    """
    variables = {"issueId": issue_id, "body": comment_body}
    
    response = requests.post(
        LINEAR_API_URL,
        json={"query": query, "variables": variables},
        headers=headers
    )
    
    if response.status_code == 200 and response.json().get("data", {}).get("commentCreate", {}).get("success"):
        print(f"✅ Successfully posted comment to Linear issue {issue_id}.")
    else:
        print(f"❌ Failed to post comment to Linear issue {issue_id}.")
        print(response.text)

# --- Main Execution ---

def main():
    parser = argparse.ArgumentParser(description="Sync agent attempts to Linear.")
    parser.add_argument(
        "issue_id_prefix",
        help="The prefix of the issue ID to sync (e.g., 'ISSUE-001')."
    )
    args = parser.parse_args()

    print(f"🔄 Starting sync for issue prefix: {args.issue_id_prefix}...")

    issue_path = find_issue_path(args.issue_id_prefix)
    if not issue_path:
        print(f"❌ Could not find issue with prefix '{args.issue_id_prefix}'.")
        return

    # Get Linear ID from the issue file
    issue_file = issue_path / "issue.md"
    with open(issue_file, "r") as f:
        content = f.read()
    frontmatter = yaml.safe_load(content.split("---", 2)[1])
    linear_id = frontmatter.get("linear_id")

    if not linear_id or "REPLACE" in linear_id:
        print(f"⚠️ Skipping sync: `linear_id` not set in {issue_file}.")
        return

    latest_attempt_path = get_latest_attempt(issue_path)
    if not latest_attempt_path:
        print(f"🤷 No attempts found for issue '{args.issue_id_prefix}'. Nothing to sync.")
        return

    print(f"📝 Found latest attempt: {latest_attempt_path.name}")
    
    comment = format_attempt_for_linear(latest_attempt_path, issue_path.name)
    post_comment_to_linear(linear_id, comment)

if __name__ == "__main__":
    main() 