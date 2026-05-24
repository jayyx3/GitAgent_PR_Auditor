"use client";

import React, { useState, useEffect } from "react";

// Types corresponding to Backend models
interface AgentSkill {
  name: string;
  description: string;
}

interface AgentResponse {
  name: string;
  version: string;
  description: string;
  model: string;
  soul: string;
  rules: string;
  skills: AgentSkill[];
}

interface Issue {
  file: string;
  line: number;
  severity: string;
  category: string;
  description: string;
  current_code: string;
  suggested_code: string;
}

interface PRMetadata {
  title: string;
  author: string;
  author_avatar: string;
  state: string;
  additions: number;
  deletions: number;
  changed_files: number;
  head_branch: string;
  base_branch: string;
  created_at: string;
  html_url: string;
}

interface PRReviewResponse {
  verdict: string;
  summary: string;
  total_issues: number;
  critical_issues_count: number;
  warning_issues_count: number;
  suggestion_issues_count: number;
  issues: Issue[];
  pr_metadata?: PRMetadata;
}

// Simple Helper to Parse Basic Markdown safely in React
function renderSimpleMarkdown(markdownText: string) {
  if (!markdownText) return null;
  
  const lines = markdownText.split("\n");
  return lines.map((line, idx) => {
    let cleanLine = line.trim();
    
    // Header check
    if (cleanLine.startsWith("### ")) {
      return <h4 key={idx} style={{ marginTop: "1rem", marginBottom: "0.5rem", color: "var(--color-secondary)", fontSize: "1.1rem" }}>{cleanLine.substring(4)}</h4>;
    }
    if (cleanLine.startsWith("## ")) {
      return <h3 key={idx} style={{ marginTop: "1.25rem", marginBottom: "0.6rem", color: "var(--color-secondary)", fontSize: "1.25rem" }}>{cleanLine.substring(3)}</h3>;
    }
    if (cleanLine.startsWith("# ")) {
      return <h2 key={idx} style={{ marginTop: "1.5rem", marginBottom: "0.75rem", color: "var(--color-secondary)", fontSize: "1.4rem" }}>{cleanLine.substring(2)}</h2>;
    }
    
    // Unordered List check
    if (cleanLine.startsWith("* ") || cleanLine.startsWith("- ")) {
      const content = parseInlineMarkdown(cleanLine.substring(2));
      return <li key={idx} style={{ marginLeft: "1.25rem", listStyleType: "square", marginBottom: "0.35rem" }}>{content}</li>;
    }

    // Ordered list check
    const numMatch = cleanLine.match(/^(\d+)\.\s(.*)/);
    if (numMatch) {
      const content = parseInlineMarkdown(numMatch[2]);
      return <li key={idx} style={{ marginLeft: "1.25rem", listStyleType: "decimal", marginBottom: "0.35rem" }}>{content}</li>;
    }
    
    // Normal paragraph with inline formatting
    const content = parseInlineMarkdown(cleanLine);
    return <p key={idx} style={{ marginBottom: "0.75rem" }}>{content}</p>;
  });
}

// Sub-helper for bold/italic/code tags inside markdown lines
function parseInlineMarkdown(text: string) {
  // Regex patterns
  const boldRegex = /\*\*(.*?)\*\*/g;
  const codeRegex = /`(.*?)`/g;
  
  let parts: React.ReactNode[] = [];
  let lastIndex = 0;
  
  // A simplistic inline scanner
  let workingText = text;
  
  // Replace code tags
  const matches: { start: number; end: number; type: "bold" | "code"; text: string }[] = [];
  
  let boldMatch;
  while ((boldMatch = boldRegex.exec(text)) !== null) {
    matches.push({
      start: boldMatch.index,
      end: boldMatch.index + boldMatch[0].length,
      type: "bold",
      text: boldMatch[1]
    });
  }
  
  let codeMatch;
  while ((codeMatch = codeRegex.exec(text)) !== null) {
    matches.push({
      start: codeMatch.index,
      end: codeMatch.index + codeMatch[0].length,
      type: "code",
      text: codeMatch[1]
    });
  }
  
  // Sort matches by start index
  matches.sort((a, b) => a.start - b.start);
  
  // Build React array safely
  let index = 0;
  matches.forEach((m, mIdx) => {
    // If overlap, skip
    if (m.start < index) return;
    
    // Add text before match
    if (m.start > index) {
      parts.push(text.substring(index, m.start));
    }
    
    // Add matched formatted component
    if (m.type === "bold") {
      parts.push(<strong key={`b-${mIdx}`} style={{ color: "var(--color-secondary)" }}>{m.text}</strong>);
    } else if (m.type === "code") {
      parts.push(<code key={`c-${mIdx}`} style={{ fontFamily: "var(--font-geist-mono)", background: "rgba(255,255,255,0.08)", padding: "0.1rem 0.25rem", borderRadius: "4px", fontSize: "0.85rem" }}>{m.text}</code>);
    }
    
    index = m.end;
  });
  
  if (index < text.length) {
    parts.push(text.substring(index));
  }
  
  return parts.length > 0 ? parts : text;
}

export default function GitAgentPRReviewer() {
  // Input states
  const [repoUrl, setRepoUrl] = useState("https://github.com/fastapi/fastapi");
  const [prNumber, setPrNumber] = useState("15590");
  const [githubToken, setGithubToken] = useState("");
  const [geminiApiKey, setGeminiApiKey] = useState("");

  // UI state
  const [agentSpec, setAgentSpec] = useState<AgentResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [reviewResult, setReviewResult] = useState<PRReviewResponse | null>(null);
  
  // Filters for Issues
  const [activeFilter, setActiveFilter] = useState<"all" | "bug" | "security" | "best_practice" | "error_handling" | "secrets">("all");
  
  // Copy to clipboard notification
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const BACKEND_URL = "http://localhost:8000";

  // Fetch Agent specification on mount
  useEffect(() => {
    async function fetchAgentSpec() {
      try {
        const response = await fetch(`${BACKEND_URL}/api/agent`);
        if (!response.ok) {
          throw new Error("Could not contact FastAPI server");
        }
        const data = await response.json();
        setAgentSpec(data);
      } catch (err) {
        console.error("Failed to load agent specifications", err);
      }
    }
    fetchAgentSpec();
  }, []);

  // Custom visual loading spinner cycle animation simulation
  useEffect(() => {
    if (!isLoading) return;
    
    const steps = [
      "Parsing repository URL structure...",
      "Resolving open GitAgent specification files...",
      "Fetching PR metadata from GitHub APIs...",
      "Downloading raw git diff contents...",
      "Initializing GitAgent PR Auditor persona...",
      "Analyzing modifications for bug hazards...",
      "Auditing credentials and checking for leaks...",
      "Applying rules and formulating suggestions...",
      "Formatting structured audit review..."
    ];
    
    let currentIdx = 0;
    setLoadingStep(steps[0]);
    
    const interval = setInterval(() => {
      currentIdx = (currentIdx + 1) % steps.length;
      setLoadingStep(steps[currentIdx]);
    }, 3000);
    
    return () => clearInterval(interval);
  }, [isLoading]);

  // Submit Review Request
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoUrl || !prNumber) {
      setError("Please fill in both the Repository URL and Pull Request number.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setReviewResult(null);

    try {
      const payload: any = {
        repo_url: repoUrl.trim(),
        pr_number: parseInt(prNumber.trim(), 10)
      };

      if (githubToken.trim()) {
        payload.github_token = githubToken.trim();
      }

      // Check if custom GEMINI_API_KEY is supplied, otherwise backend uses its env
      const headers: HeadersInit = {
        "Content-Type": "application/json"
      };

      const response = await fetch(`${BACKEND_URL}/api/review`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: "Unknown backend error" }));
        throw new Error(errorData.detail || `Server responded with ${response.status}`);
      }

      const data = await response.json();
      setReviewResult(data);
      setActiveFilter("all");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An unexpected error occurred during GitAgent execution.");
    } finally {
      setIsLoading(false);
    }
  };

  // Run a quick Demo with preloaded values
  const runDemo = (url: string, pr: string) => {
    setRepoUrl(url);
    setPrNumber(pr);
  };

  // Copy Suggestion Helper
  const handleCopyCode = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // Filter issues
  const filteredIssues = reviewResult
    ? reviewResult.issues.filter((issue) => {
        if (activeFilter === "all") return true;
        return issue.category === activeFilter;
      })
    : [];

  // Categorize colors
  const getSeverityBadge = (severity: string) => {
    switch (severity.toLowerCase()) {
      case "critical":
        return <span className="badge badge-critical">Critical</span>;
      case "warning":
        return <span className="badge badge-warning">Warning</span>;
      case "suggestion":
        return <span className="badge badge-suggestion">Suggestion</span>;
      default:
        return <span className="badge">{severity}</span>;
    }
  };

  const getIssueStyle = (category: string) => {
    switch (category) {
      case "bug":
        return { "--issue-accent-color": "var(--color-primary)" } as React.CSSProperties;
      case "security":
        return { "--issue-accent-color": "var(--color-critical)" } as React.CSSProperties;
      case "secrets":
        return { "--issue-accent-color": "var(--color-critical)" } as React.CSSProperties;
      case "best_practice":
        return { "--issue-accent-color": "var(--color-secondary)" } as React.CSSProperties;
      case "error_handling":
        return { "--issue-accent-color": "var(--color-warning)" } as React.CSSProperties;
      default:
        return {} as React.CSSProperties;
    }
  };

  return (
    <div className="app-container">
      {/* Sidebar - Settings & Live Agent Spec */}
      <aside className="sidebar">
        <div>
          <h1 className="brand-title">
            <span>🤖</span> GitAgent PR Auditor
          </h1>
          <p className="brand-subtitle">Treat your Git repo as the Agent</p>
        </div>

        {/* Input Form */}
        <form className="glass-card" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="repo-url">Repository URL</label>
            <input
              id="repo-url"
              className="text-input"
              type="text"
              placeholder="https://github.com/owner/repo"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="pr-number">Pull Request Number</label>
            <input
              id="pr-number"
              className="text-input"
              type="number"
              placeholder="e.g. 42"
              value={prNumber}
              onChange={(e) => setPrNumber(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="github-token">GitHub Token (Optional)</label>
            <input
              id="github-token"
              className="text-input"
              type="password"
              placeholder="For private repos or rate bypass"
              value={githubToken}
              onChange={(e) => setGithubToken(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <button className="btn-glow" type="submit" disabled={isLoading} style={{ width: "100%" }}>
            {isLoading ? "Auditing PR..." : "Launch GitAgent Audit"}
          </button>
        </form>

        <div className="section-divider" />

        {/* Live GitAgent Specification Manifest */}
        <div className="agent-manifest-section">
          <h2 style={{ fontSize: "1.1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span>📄</span> Loaded Spec Manifesto
          </h2>
          
          {agentSpec ? (
            <>
              <div className="meta-row">
                <span className="meta-label">Agent Name</span>
                <span className="meta-value">{agentSpec.name}</span>
              </div>
              <div className="meta-row">
                <span className="meta-label">Version</span>
                <span className="meta-value">{agentSpec.version}</span>
              </div>
              <div className="meta-row">
                <span className="meta-label">Configured LLM</span>
                <span className="meta-value">{agentSpec.model}</span>
              </div>

              <div className="form-group" style={{ marginTop: "0.5rem" }}>
                <span className="form-label">Soul Personality</span>
                <div className="agent-scroll-box">
                  <p>{agentSpec.soul || "No soul configured."}</p>
                </div>
              </div>

              <div className="form-group">
                <span className="form-label">Strict Rules</span>
                <div className="agent-scroll-box">
                  <p>{agentSpec.rules || "No rules configured."}</p>
                </div>
              </div>

              <div className="form-group">
                <span className="form-label">Defined skills</span>
                <div style={{ marginTop: "0.25rem" }}>
                  {agentSpec.skills.map((s, idx) => (
                    <span key={idx} className="skill-tag" title={s.description}>
                      {s.name}
                    </span>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontStyle: "italic" }}>
              FastAPI backend is offline. Run uvicorn server in d:/PROJECTS/Lyzr Assignment/backend to activate local agent.
            </p>
          )}
        </div>
      </aside>

      {/* Main Workspace */}
      <main className="main-content">
        
        {/* Error Handling Banner */}
        {error && (
          <div className="glass-card" style={{ borderLeft: "4px solid var(--color-critical)", background: "rgba(244, 63, 94, 0.05)" }}>
            <h3 style={{ color: "var(--color-critical)", marginBottom: "0.5rem" }}>⚠️ GitAgent Audit Interrupted</h3>
            <p style={{ color: "var(--text-main)", fontSize: "0.95rem" }}>{error}</p>
          </div>
        )}

        {/* LOADING SCREEN */}
        {isLoading && (
          <div className="glass-card loader-container">
            <div className="spinner" />
            <div>
              <h2 style={{ fontSize: "1.4rem", fontWeight: 700 }}>GitAgent PR Auditor active</h2>
              <div className="loader-step">{loadingStep}</div>
            </div>
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", maxWidth: "450px" }}>
              GitAgent is parsing the git diff, matching lines against system rules defined in rules.md, and invoking advanced logical checks in your repository.
            </p>
          </div>
        )}

        {/* WELCOME / INITIAL STATE SCREEN */}
        {!isLoading && !reviewResult && (
          <div className="welcome-panel">
            <div className="welcome-logo">🚀</div>
            <h2 style={{ fontSize: "2rem", fontWeight: 800 }}>Welcome to the GitAgent PR Auditor Workspace</h2>
            <div className="welcome-accent-box" />
            <p className="welcome-lead">
              A high-precision, production-grade automated code audit companion built completely on the open <strong>GitAgent standard</strong>.
            </p>
            <p style={{ color: "var(--text-muted)", fontSize: "0.95rem", maxWidth: "550px" }}>
              Input any public GitHub repository and its Pull Request number. GitAgent will pull the changes, run security and correctness rules, and construct a beautiful, detailed static audit directly in your browser.
            </p>
            
            <div className="demo-buttons-container">
              <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", alignSelf: "center", marginRight: "0.5rem" }}>Try a Demo PR:</span>
              <button className="btn-secondary" onClick={() => runDemo("https://github.com/fastapi/fastapi", "15590")}>
                FastAPI PR #15590
              </button>
              <button className="btn-secondary" onClick={() => runDemo("https://github.com/django/django", "21346")}>
                Django PR #21346
              </button>
            </div>
          </div>
        )}

        {/* RESULTS WORKSPACE */}
        {!isLoading && reviewResult && (
          <>
            {/* PR Details and Summary Header */}
            {reviewResult.pr_metadata && (
              <section className="glass-card pr-header-card">
                <div className="pr-info-box">
                  {reviewResult.pr_metadata.author_avatar && (
                    <img className="pr-avatar" src={reviewResult.pr_metadata.author_avatar} alt="PR Author avatar" />
                  )}
                  <div className="pr-details">
                    <h2 className="pr-title">
                      <a href={reviewResult.pr_metadata.html_url} target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "none" }}>
                        {reviewResult.pr_metadata.title}
                      </a>
                    </h2>
                    <div className="pr-meta-subtitle">
                      <span>by @{reviewResult.pr_metadata.author}</span>
                      <span>•</span>
                      <span className="branch-name">{reviewResult.pr_metadata.base_branch}</span>
                      <span>←</span>
                      <span className="branch-name">{reviewResult.pr_metadata.head_branch}</span>
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "1.5rem", alignItems: "center" }}>
                  <div className="diff-stats">
                    <span className="stat-additions">+{reviewResult.pr_metadata.additions}</span>
                    <span className="stat-deletions">-{reviewResult.pr_metadata.deletions}</span>
                    <span style={{ color: "var(--text-muted)" }}>({reviewResult.pr_metadata.changed_files} files)</span>
                  </div>
                  <div>
                    {reviewResult.verdict.toLowerCase() === "approved" ? (
                      <span className="badge badge-verdict-approved" style={{ padding: "0.5rem 1rem", fontSize: "0.85rem" }}>Approved</span>
                    ) : (
                      <span className="badge badge-verdict-review" style={{ padding: "0.5rem 1rem", fontSize: "0.85rem" }}>Review Required</span>
                    )}
                  </div>
                </div>
              </section>
            )}

            {/* Metrics Dashboard Row */}
            <section className="stats-grid">
              <div className="glass-card stat-card" style={{ "--accent-color": "var(--color-primary)" } as React.CSSProperties}>
                <span className="stat-label">Total Issues</span>
                <span className="stat-value">{reviewResult.total_issues}</span>
              </div>
              <div className="glass-card stat-card" style={{ "--accent-color": "var(--color-critical)" } as React.CSSProperties}>
                <span className="stat-label">Critical Risks</span>
                <span className="stat-value" style={{ color: reviewResult.critical_issues_count > 0 ? "var(--color-critical)" : "inherit" }}>
                  {reviewResult.critical_issues_count}
                </span>
              </div>
              <div className="glass-card stat-card" style={{ "--accent-color": "var(--color-warning)" } as React.CSSProperties}>
                <span className="stat-label">Warnings</span>
                <span className="stat-value" style={{ color: reviewResult.warning_issues_count > 0 ? "var(--color-warning)" : "inherit" }}>
                  {reviewResult.warning_issues_count}
                </span>
              </div>
              <div className="glass-card stat-card" style={{ "--accent-color": "var(--color-suggestion)" } as React.CSSProperties}>
                <span className="stat-label">Suggestions</span>
                <span className="stat-value">{reviewResult.suggestion_issues_count}</span>
              </div>
            </section>

            {/* Executive Summary Card */}
            <section className="glass-card">
              <h2 style={{ fontSize: "1.25rem", marginBottom: "1rem", color: "var(--color-secondary)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span>📝</span> Executive Audit Summary
              </h2>
              <div className="markdown-summary">
                {renderSimpleMarkdown(reviewResult.summary)}
              </div>
            </section>

            {/* Issues Feed Panel */}
            <section>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", flexWrap: "wrap", gap: "0.75rem" }}>
                <h2 style={{ fontSize: "1.25rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span>🛡️</span> Detailed Findings ({filteredIssues.length})
                </h2>
                
                {/* Filter Tabs */}
                <div className="filter-tabs">
                  <button className={`filter-tab ${activeFilter === "all" ? "active" : ""}`} onClick={() => setActiveFilter("all")}>
                    All ({reviewResult.total_issues})
                  </button>
                  <button className={`filter-tab ${activeFilter === "security" ? "active" : ""}`} onClick={() => setActiveFilter("security")}>
                    Security
                  </button>
                  <button className={`filter-tab ${activeFilter === "bug" ? "active" : ""}`} onClick={() => setActiveFilter("bug")}>
                    Bugs
                  </button>
                  <button className={`filter-tab ${activeFilter === "error_handling" ? "active" : ""}`} onClick={() => setActiveFilter("error_handling")}>
                    Error Handling
                  </button>
                  <button className={`filter-tab ${activeFilter === "best_practice" ? "active" : ""}`} onClick={() => setActiveFilter("best_practice")}>
                    Quality
                  </button>
                  <button className={`filter-tab ${activeFilter === "secrets" ? "active" : ""}`} onClick={() => setActiveFilter("secrets")}>
                    Secrets
                  </button>
                </div>
              </div>

              {/* Issues Feed */}
              {filteredIssues.length === 0 ? (
                <div className="glass-card" style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)" }}>
                  <p style={{ fontSize: "1.1rem" }}>✅ Zero issues flagged in this category.</p>
                  <p style={{ fontSize: "0.85rem", marginTop: "0.25rem" }}>Great job! The PR is secure and solid according to GitAgent's rules.</p>
                </div>
              ) : (
                <div className="issues-feed">
                  {filteredIssues.map((issue, idx) => (
                    <article key={idx} className="glass-card issue-card" style={getIssueStyle(issue.category)}>
                      
                      {/* Header */}
                      <div className="issue-card-header">
                        <div className="issue-file-path">
                          <span>📂</span>
                          {issue.file}
                          <span className="issue-line-badge">Line {issue.line}</span>
                        </div>
                        
                        <div className="issue-meta-info">
                          <span className="skill-tag" style={{ textTransform: "capitalize", margin: 0 }}>
                            {issue.category.replace("_", " ")}
                          </span>
                          {getSeverityBadge(issue.severity)}
                        </div>
                      </div>

                      {/* Description */}
                      <p className="issue-description">{issue.description}</p>

                      {/* Side-by-Side Diff Panels */}
                      {(issue.current_code.trim() || issue.suggested_code.trim()) && (
                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                            <span className="form-label" style={{ fontSize: "0.75rem" }}>Suggested Refactoring</span>
                            <button
                              className="btn-secondary"
                              style={{ padding: "0.25rem 0.6rem", fontSize: "0.75rem", display: "flex", alignItems: "center", gap: "0.25rem" }}
                              onClick={() => handleCopyCode(issue.suggested_code, idx)}
                            >
                              {copiedIndex === idx ? "Copied!" : "📋 Copy Suggestion"}
                            </button>
                          </div>
                          
                          <div className="code-diff-container">
                            {issue.current_code.trim() && (
                              <div className="diff-pane diff-pane-before">
                                <div className="diff-pane-title">Before (Original Code)</div>
                                <pre className="diff-code-block"><code>{issue.current_code}</code></pre>
                              </div>
                            )}
                            {issue.suggested_code.trim() && (
                              <div className="diff-pane diff-pane-after">
                                <div className="diff-pane-title">After (Suggested Fix)</div>
                                <pre className="diff-code-block"><code>{issue.suggested_code}</code></pre>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
