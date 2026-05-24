import os
import yaml
import json
import logging
from typing import Dict, Any, List
import google.generativeai as genai
from fastapi import HTTPException

from app.config import AGENT_YAML_PATH, SOUL_MD_PATH, RULES_MD_PATH, GEMINI_API_KEY
from app.models import PRReviewResponse, PRReviewResponseLLM, AgentResponse, AgentSkill, Issue

logger = logging.getLogger("agent_runner")

def load_agent_spec() -> AgentResponse:
    """
    Loads agent.yaml, SOUL.md, and RULES.md from the root directory.
    Constructs a full AgentResponse object representing the GitAgent configuration.
    """
    if not os.path.exists(AGENT_YAML_PATH):
        raise HTTPException(status_code=500, detail="agent.yaml missing from workspace root")
        
    try:
        with open(AGENT_YAML_PATH, "r", encoding="utf-8") as f:
            manifest = yaml.safe_load(f) or {}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse agent.yaml: {str(e)}")
        
    # Read SOUL.md
    soul_content = ""
    if os.path.exists(SOUL_MD_PATH):
        try:
            with open(SOUL_MD_PATH, "r", encoding="utf-8") as f:
                soul_content = f.read()
        except Exception as e:
            logger.warning(f"Failed to read SOUL.md: {e}")
            
    # Read RULES.md
    rules_content = ""
    if os.path.exists(RULES_MD_PATH):
        try:
            with open(RULES_MD_PATH, "r", encoding="utf-8") as f:
                rules_content = f.read()
        except Exception as e:
            logger.warning(f"Failed to read RULES.md: {e}")
            
    skills = []
    for skill in manifest.get("skills", []):
        skills.append(AgentSkill(
            name=skill.get("name", "unknown"),
            description=skill.get("description", "")
        ))
        
    return AgentResponse(
        name=manifest.get("name", "GitAgent PR Auditor"),
        version=manifest.get("version", "1.0.0"),
        description=manifest.get("description", "A git-native review agent"),
        model=manifest.get("model", "gemini-1.5-flash"),
        soul=soul_content,
        rules=rules_content,
        skills=skills
    )

async def run_pr_review_agent(diff_text: str, pr_metadata: Dict[str, Any], api_key: str) -> PRReviewResponse:
    """
    Runs the GitAgent to audit a PR diff.
    Sets up the Gemini LLM with the loaded GitAgent soul and rules as its system prompt.
    """
    # Load the agent spec
    agent_spec = load_agent_spec()
    
    # Configure Gemini API
    if not api_key:
        raise HTTPException(status_code=400, detail="Gemini API Key is missing. Please configure GEMINI_API_KEY in the backend or supply it.")
        
    genai.configure(api_key=api_key)
    
    # Build a powerful system instruction summarizing the GitAgent manifesto
    system_instruction = f"""
You are {agent_spec.name} (v{agent_spec.version}).
Manifesto: {agent_spec.description}

YOUR SOUL AND PERSONA:
{agent_spec.soul}

YOUR STRICT OPERATIONAL RULES:
{agent_spec.rules}

IMPORTANT COMPLIANCE FOR YOUR OUTPUT SCHEMA:
You must return a structured JSON object matching the PRReviewResponse schema.
It must contain:
1. "verdict": 'Approved' if there are zero issues with 'critical' or 'warning' severity. Otherwise 'Review Required'.
2. "summary": A premium, detailed markdown analysis summarizing what changes are made in the PR, the quality of code, and positive highlights as well as structural criticisms.
3. "total_issues": Total number of findings.
4. "critical_issues_count": Count of issues with severity == 'critical'.
5. "warning_issues_count": Count of issues with severity == 'warning'.
6. "suggestion_issues_count": Count of issues with severity == 'suggestion'.
7. "issues": A list of issues. Each issue must have:
   - "file": The file path relative to repo root (extract this from the diff header, e.g. "src/main.py").
   - "line": The approximate line number where the issue was introduced (use diff line markers @@ -... +... @@ as your reference).
   - "severity": 'critical' (blockers, security exploits, hardcoded keys), 'warning' (bugs, major anti-patterns, missing error handles), or 'suggestion' (style enhancements, optimizations).
   - "category": 'bug', 'security', 'best_practice', 'error_handling', or 'secrets'.
   - "description": A highly constructive and helpful feedback comment.
   - "current_code": The exact problematic snippet.
   - "suggested_code": The corrected, complete snippet to replace the problematic code.
"""

    prompt = f"""
Review the following Git Pull Request and generate the structured review.

PULL REQUEST CONTEXT:
- Title: {pr_metadata.get('title')}
- Author: {pr_metadata.get('author')}
- Branches: {pr_metadata.get('base_branch')} <- {pr_metadata.get('head_branch')}
- Additions: +{pr_metadata.get('additions')} lines
- Deletions: -{pr_metadata.get('deletions')} lines
- Changed Files: {pr_metadata.get('changed_files')}

RAW GIT DIFF CONTENT:
```diff
{diff_text}
```

Evaluate the diff carefully, line-by-line. Focus on bug detection, security, missing try-catch error handling, bad practices, and hardcoded secrets. If you find no issues, return an empty issue list with an encouraging summary and verdict 'Approved'.
"""

    try:
        # We target gemini-1.5-flash since it supports robust json output schemas
        # If the user specified a custom model in agent.yaml, we can use that, but map it to a valid Gemini name.
        # Dynamically load the model specified in the GitAgent manifesto!
        model_name = agent_spec.model
            
        model = genai.GenerativeModel(
            model_name=model_name,
            system_instruction=system_instruction
        )
        
        # Invoke generation with JSON mode enabled (Pydantic schema is described in system instructions)
        response = model.generate_content(
            prompt,
            generation_config=genai.GenerationConfig(
                response_mime_type="application/json",
                temperature=0.2
            )
        )
        
        # Load and parse response
        logger.info(f"LLM Raw Response: {response.text}")
        review_data = json.loads(response.text)
        
        # Post-process count calculation to ensure absolute mathematical correctness
        issues_list = []
        for issue_raw in review_data.get("issues", []):
            issues_list.append(Issue(**issue_raw))
            
        critical_count = sum(1 for iss in issues_list if iss.severity == "critical")
        warning_count = sum(1 for iss in issues_list if iss.severity == "warning")
        suggestion_count = sum(1 for iss in issues_list if iss.severity == "suggestion")
        
        verdict = "Approved"
        if critical_count > 0 or warning_count > 0:
            verdict = "Review Required"
            
        return PRReviewResponse(
            verdict=verdict,
            summary=review_data.get("summary", "No summary provided by auditor."),
            total_issues=len(issues_list),
            critical_issues_count=critical_count,
            warning_issues_count=warning_count,
            suggestion_issues_count=suggestion_count,
            issues=issues_list
        )
        
    except json.JSONDecodeError as jde:
        logger.error(f"Failed to parse LLM JSON: {jde}. Raw output: {response.text if 'response' in locals() else 'None'}")
        raise HTTPException(
            status_code=500, 
            detail=f"AI Agent output failed to parse. Output was not valid JSON."
        )
    except Exception as e:
        logger.error(f"Error during agent invocation: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Internal AI Agent error: {str(e)}"
        )
