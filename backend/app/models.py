from pydantic import BaseModel, Field
from typing import List, Optional

class PRRequest(BaseModel):
    repo_url: str = Field(..., description="Full URL of the GitHub Repository (e.g. https://github.com/owner/repo)")
    pr_number: int = Field(..., description="The Pull Request number to review")
    github_token: Optional[str] = Field(None, description="Optional GitHub Personal Access Token")

class Issue(BaseModel):
    file: str = Field(..., description="File path relative to repository root")
    line: int = Field(..., description="Approximate starting line number of the issue")
    severity: str = Field(..., description="Severity level: 'critical', 'warning', or 'suggestion'")
    category: str = Field(..., description="Category: 'bug', 'security', 'best_practice', 'error_handling', or 'secrets'")
    description: str = Field(..., description="Brief, constructive explanation of the problem and why it is an issue")
    current_code: str = Field(..., description="The exact code chunk containing the issue")
    suggested_code: str = Field(..., description="Direct replacement code proposing the resolution")

class PRReviewResponseLLM(BaseModel):
    verdict: str = Field(..., description="Final assessment: 'Approved' (no warning/critical issues) or 'Review Required'")
    summary: str = Field(..., description="High-level markdown summary of the changes and overall quality audit")
    total_issues: int = Field(..., description="Total count of issues found")
    critical_issues_count: int = Field(..., description="Count of critical issues")
    warning_issues_count: int = Field(..., description="Count of warning issues")
    suggestion_issues_count: int = Field(..., description="Count of suggestions")
    issues: List[Issue] = Field(..., description="List of individual code findings")

class PRReviewResponse(BaseModel):
    verdict: str
    summary: str
    total_issues: int
    critical_issues_count: int
    warning_issues_count: int
    suggestion_issues_count: int
    issues: List[Issue]
    pr_metadata: Optional[dict] = None

class AgentSkill(BaseModel):
    name: str
    description: str

class AgentResponse(BaseModel):
    name: str
    version: str
    description: str
    model: str
    soul: str
    rules: str
    skills: List[AgentSkill]
