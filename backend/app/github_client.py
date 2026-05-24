import re
import httpx
from typing import Dict, Any, Tuple, Optional
from fastapi import HTTPException

def parse_github_url(url: str) -> Tuple[str, str]:
    """
    Parses a GitHub repo URL or PR URL to extract owner and repository name.
    Handles:
    - https://github.com/owner/repo
    - https://github.com/owner/repo/pull/123
    - git@github.com:owner/repo.git
    """
    url = url.strip()
    # Check standard HTTPS format
    match = re.search(r"github\.com/([^/]+)/([^/]+)", url)
    if match:
        owner = match.group(1)
        repo = match.group(2)
        # Strip trailing things like .git or /
        if repo.endswith(".git"):
            repo = repo[:-4]
        if "/" in repo:
            repo = repo.split("/")[0]
        return owner, repo
    
    # Check SSH format
    match_ssh = re.search(r"git@github\.com:([^/]+)/([^/]+)\.git", url)
    if match_ssh:
        return match_ssh.group(1), match_ssh.group(2)
        
    raise HTTPException(status_code=400, detail="Invalid GitHub repository URL format")

async def fetch_pr_data(owner: str, repo: str, pr_number: int, token: Optional[str] = None) -> Dict[str, Any]:
    """
    Fetches the JSON metadata for a pull request (Title, Author, Additions, Deletions).
    """
    url = f"https://api.github.com/repos/{owner}/{repo}/pulls/{pr_number}"
    
    headers = {
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "GitAgent-PR-Auditor"
    }
    
    if token:
        headers["Authorization"] = f"token {token}"
        
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.get(url, headers=headers)
            if response.status_code == 404:
                raise HTTPException(status_code=404, detail=f"Pull Request #{pr_number} or Repository not found")
            elif response.status_code == 401 or response.status_code == 403:
                error_msg = response.json().get("message", "Forbidden")
                if "rate limit" in error_msg.lower():
                    raise HTTPException(status_code=429, detail="GitHub API rate limit exceeded. Please provide a GitHub Personal Access Token.")
                raise HTTPException(status_code=response.status_code, detail=f"GitHub Auth Error: {error_msg}")
            
            response.raise_for_status()
            data = response.json()
            return {
                "title": data.get("title", f"PR #{pr_number}"),
                "author": data.get("user", {}).get("login", "unknown"),
                "author_avatar": data.get("user", {}).get("avatar_url", ""),
                "state": data.get("state", "open"),
                "additions": data.get("additions", 0),
                "deletions": data.get("deletions", 0),
                "changed_files": data.get("changed_files", 0),
                "head_branch": data.get("head", {}).get("ref", "unknown"),
                "base_branch": data.get("base", {}).get("ref", "unknown"),
                "created_at": data.get("created_at", ""),
                "html_url": data.get("html_url", "")
            }
        except httpx.HTTPStatusError as exc:
            raise HTTPException(status_code=exc.response.status_code, detail=f"GitHub API Error: {str(exc)}")
        except httpx.RequestError as exc:
            raise HTTPException(status_code=500, detail=f"Failed to connect to GitHub API: {str(exc)}")

async def fetch_pr_diff(owner: str, repo: str, pr_number: int, token: Optional[str] = None) -> str:
    """
    Fetches the raw diff of a pull request using the Accept: application/vnd.github.v3.diff header.
    """
    url = f"https://api.github.com/repos/{owner}/{repo}/pulls/{pr_number}"
    
    headers = {
        "Accept": "application/vnd.github.v3.diff",
        "User-Agent": "GitAgent-PR-Auditor"
    }
    
    if token:
        headers["Authorization"] = f"token {token}"
        
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.get(url, headers=headers)
            if response.status_code == 404:
                raise HTTPException(status_code=404, detail="PR Diff not found or Repository is private")
            response.raise_for_status()
            return response.text
        except httpx.HTTPStatusError as exc:
            raise HTTPException(status_code=exc.response.status_code, detail=f"Failed to fetch PR diff: {str(exc)}")
        except httpx.RequestError as exc:
            raise HTTPException(status_code=500, detail=f"Connection error to GitHub: {str(exc)}")
