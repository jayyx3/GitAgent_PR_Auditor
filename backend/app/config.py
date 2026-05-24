import os
from dotenv import load_dotenv

# Load env variables from .env file
load_dotenv()

# We can search parent directories too
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")

# Base directory paths
AGENT_YAML_PATH = os.path.join(ROOT_DIR, "agent.yaml")
SOUL_MD_PATH = os.path.join(ROOT_DIR, "SOUL.md")
RULES_MD_PATH = os.path.join(ROOT_DIR, "RULES.md")
