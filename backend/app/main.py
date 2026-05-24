import logging
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, Any

from app.config import GEMINI_API_KEY
from app.models import PRRequest, PRReviewResponse, AgentResponse
from app.github_client import parse_github_url, fetch_pr_data, fetch_pr_diff
from app.agent_runner import load_agent_spec, run_pr_review_agent

# Initialize logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("main")

app = FastAPI(
    title="GitAgent PR Auditor Backend",
    description="A Python FastAPI backend that retrieves GitHub PR details and executes a native GitAgent review workflow.",
    version="1.0.0"
)

# Enable CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In development, allow all origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health", status_code=status.HTTP_200_OK)
def health_check() -> Dict[str, str]:
    """
    Standard health check to confirm server uptime.
    """
    return {"status": "healthy", "agent": "GitAgent PR Auditor"}

@app.get("/api/agent", response_model=AgentResponse)
def get_agent_details() -> AgentResponse:
    """
    Loads and returns the active GitAgent specification files (manifest, soul, rules).
    Demonstrates the live 'Your Repo is your Agent' standard.
    """
    try:
        return load_agent_spec()
    except Exception as e:
        logger.error(f"Error loading agent spec: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not load GitAgent specification: {str(e)}"
        )

@app.post("/api/review", response_model=PRReviewResponse)
async def review_pull_request(request: PRRequest) -> PRReviewResponse:
    """
    Reviews a GitHub Pull Request by fetching the diff and triggering the GitAgent AI reasoning.
    """
    logger.info(f"Received review request for: {request.repo_url} | PR #{request.pr_number}")
    
    # 1. Parse URL to get owner and repository name
    owner, repo = parse_github_url(request.repo_url)
    logger.info(f"Parsed URL: Owner = {owner}, Repo = {repo}")
    
    # 2. Get the GitHub Token (prefer request token, fallback to environment)
    github_token = request.github_token or getattr(request, "github_token", None)
    
    # 3. Retrieve PR metadata and PR raw diff in parallel/sequentially
    try:
        logger.info("Fetching PR metadata from GitHub...")
        pr_metadata = await fetch_pr_data(owner, repo, request.pr_number, token=github_token)
        
        logger.info("Fetching PR raw diff from GitHub...")
        diff_text = await fetch_pr_diff(owner, repo, request.pr_number, token=github_token)
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Failed to fetch data from GitHub: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to communicate with GitHub API: {str(e)}"
        )
        
    if not diff_text or diff_text.strip() == "":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The retrieved pull request has an empty diff (no changes found)."
        )
        
    # 4. Confirm Gemini API Key exists
    from dotenv import load_dotenv
    import os
    env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
    load_dotenv(dotenv_path=env_path)
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        logger.error("GEMINI_API_KEY environment variable is not configured.")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="GEMINI_API_KEY is not configured on the server. Please supply it or configure the server's environment."
        )
        
    # 5. Run the GitAgent reasoning workflow
    logger.info("Executing GitAgent PR Auditor review pipeline...")
    try:
        review_result = await run_pr_review_agent(diff_text, pr_metadata, api_key)
        review_result.pr_metadata = pr_metadata
        logger.info("GitAgent audit review generated successfully!")
        return review_result
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Error executing agent review: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred during agent execution: {str(e)}"
        )
