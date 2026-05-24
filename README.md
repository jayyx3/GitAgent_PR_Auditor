# 🤖 GitAgent PR Auditor

A premium, production-grade **Git-Native Pull Request Code Review Agent** that automates static analysis, security checks, and code quality audits directly in your development pipeline.

Built as a submission for the **Lyzr Builder Challenge**, this project strictly implements the **Open GitAgent Standard**—treating the repository itself as the source of truth for the AI's identity, skills, and behavior rules.

---

## ⚡ The GitAgent Philosophy: "Your Repo is Your Agent"

Unlike traditional AI integrations where instructions, prompts, and configurations are hidden in external dashboards or hardcoded inside code, this auditor is a **git-native agent** defined entirely by version-controlled files in the root of the repository:

* **`agent.yaml`**: The agent manifesto. Defines the metadata, active models, and core skills (`fetch_pr_diff` and `generate_audit`).
* **`SOUL.md`**: The agent's identity. Configures a Senior Staff Engineer and Principal Security Architect persona—meticulous, direct, and constructive.
* **`RULES.md`**: Strict operational guardrails. Enforces line-level context, copy-pasteable before-and-after suggestions, and zero tolerance for plaintext credentials.

To change the auditor's style or add custom linting rules, **simply modify the markdown assets, commit them, and leverage standard git workflows (like branching and rollbacks) to manage your agent's behavior**.

---

## ✨ Features

* **🎭 Dynamic Persona Spec Panel**: The web dashboard automatically fetches the repository's active GitAgent manifesto, soul description, and strict rules from `/api/agent`, displaying them live in the sidebar.
* **🔒 Meticulous Audit Specializations**:
  * **Critical Bugs**: Logical anomalies, race conditions, memory issues, and bad bounds.
  * **Security Vulnerabilities**: Injection attacks, unsafe deserialization, and missing controls.
  * **Hardcoded Secrets**: Plaintext API keys, connection strings, and certificates.
  * **Error Safety**: Silent catches, resource management leaks, and unhandled branches.
  * **Code Smells**: Premature complexities, deep nesting, and anti-patterns.
* **📊 Visual Executive Summary & Metrics**: A high-fidelity metrics bar tracking overall audit verdict alongside separate indicators for Critical, Warning, and Suggestion dimensions.
* **🔄 Side-by-Side Code Diff Viewer**: Displays clean, syntax-highlighted code recommendations side-by-side, allowing developers to refactor instantly with click-to-copy code blocks.
* **🚀 Zero-Configuration Demo Prompts**: Includes preloaded clicks to test the auditor instantly on valid closed pull requests.

---

## 🏗️ Architecture

```
                       ┌──────────────────────┐
                       │   Next.js Frontend   │
                       │   (React / TS / CSS) │
                       └──────────┬───────────┘
                                  │
                       (JSON API Requests)
                                  │
                                  ▼
                       ┌──────────────────────┐
                       │   FastAPI Backend    │
                       │       (Python)       │
                       └────┬────────────┬────┘
                            │            │
             (Reads Spec)   │            │   (Fetches Diff)
                            ▼            ▼
┌──────────────────────────────┐      ┌──────────────────────┐
│  GitAgent Spec (agent.yaml,  │      │     GitHub APIs      │
│     SOUL.md, RULES.md)       │      └──────────────────────┘
└──────────────────────────────┘
```

---

## 💻 Tech Stack

* **Backend**: FastAPI, Pydantic (data formatting and validation), HTTPX (async requests), Google Generative AI SDK, `python-dotenv`.
* **Frontend**: Next.js 16 (TypeScript, React), Custom responsive **Vanilla CSS** (establishing a premium glassmorphic dark-theme design system with custom scrollbars and glowing borders).
* **AI Model**: Google Gemini 2.5 Flash (utilizing strict Pydantic JSON schema generation to guarantee structured data delivery).

---

## 🚀 Installation & Local Setup

Ensure you have **Python 3.12+** and **Node.js 20+** installed on your local machine.

### 1. Setup Backend (FastAPI)
1. Navigate to the `backend` directory:
   ```bash
   cd backend
   ```
2. Duplicate `.env.example` as a new `.env` file:
   ```bash
   copy .env.example .env
   ```
3. Fill in your **Google Gemini API Key** (and optionally a `GITHUB_TOKEN` to bypass public API limits):
   ```ini
   GEMINI_API_KEY=AIzaSy...your-actual-gemini-key
   GITHUB_TOKEN=your-github-personal-access-token-optional
   ```
4. Install python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
5. Start the FastAPI backend service:
   ```bash
   uvicorn app.main:app --reload
   ```
   *The server is active on `http://127.0.0.1:8000`.*

---

### 2. Setup Frontend (Next.js)
1. Navigate to the `frontend` directory:
   ```bash
   cd ../frontend
   ```
2. Install npm packages:
   ```bash
   npm install
   ```
3. Launch the Next.js development hot-reloader:
   ```bash
   npm run dev
   ```
   *Open `http://localhost:3000` in your web browser to enter the workspace.*

---

## 🛡️ Testing out-of-the-box

You can test the auditor immediately using our preloaded demo buttons on the welcome page, or manually inputting public repositories:

* **Repository URL**: `https://github.com/fastapi/fastapi`
* **Pull Request**: `15590` (A modern `Annotated` documentation example) or `15570` (Core python logic catching `ImportError` exceptions).

---

## 📜 License

This project is open-source and available under the MIT License.
