<div align="center">

<img src="assets/logo.png" alt="Agent Lens Logo" width="128" height="128" />

# Agent Lens
### AI Agent Security & Activity Monitor

*Understand what AI agents and developer tools are doing on your computer, detect suspicious behavior, identify potential sensitive-data exposure, and receive evidence-based security recommendations.*

[![Build](https://img.shields.io/badge/build-passing-brightgreen.svg)]()
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows-blue.svg)]()
[![Privacy](https://img.shields.io/badge/privacy-100%25%20local-success.svg)]()
[![License](https://img.shields.io/badge/license-MIT-informational.svg)]()

</div>

---

## 🎯 What is Agent Lens?

As developer AI agents (such as **Claude Code**, **Cursor**, **Copilot CLI**, **Devin**, **Aider**, and **Open Interpreter**) gain shell execution and network privileges on workstations, developers need visibility and guardrails to ensure their codebases, credentials, and machines remain secure.

**Agent Lens** provides local-first, privacy-preserving security observability for AI agents and developer tooling without sending any of your data to the cloud.

---

## 🛡️ Core Security Principles

1. **Evidence-Based Reporting**: Never labels an agent "dangerous" without verifiable observables. Every finding includes: *What happened, Process attribution, Observed evidence, Why suspicious, What is unknown, Confidence score, and Recommended actions*.
2. **Zero Sensitive-Content Storage**: Never reads, stores, or transmits file contents, passwords, SSH private keys, API keys, or tokens. Only safe metadata (paths, categories, accessing PID, timestamps) is tracked.
3. **Deterministic Local Correlation**: Multi-signal detection, process tree hierarchy, behavioral baselines, risk scoring, and security alerts function 100% locally with zero external network dependencies.
4. **No Automatic Destructive Actions**: Never automatically terminates processes, blocks IPs, or deletes files without explicit user confirmation.

---

## 🏗️ Architecture Overview

```text
┌────────────────────────────────────────────────────────────────────────┐
│               Agent Lens — Security & Activity Monitor                 │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│ React Frontend Dashboard (Vite + Dark Mode + Security Panels)          │
│       │                                                                │
│       │ HTTP / WebSocket (127.0.0.1 Loopback Only)                     │
│       ▼                                                                │
│ Node.js Backend Server (Express + Security Correlation Engine)          │
│       │                                                                │
│ ┌─────┼─────────────┬────────────────┬──────────────┬───────────────┐  │
│ ▼     ▼             ▼                ▼              ▼               ▼  │
│Multi- Sensitive     Process Tree     Deterministic  SQLite          PF │
│Signal File Metadata & Unusual Child  Risk Scorer    Timeline/Alerts /  │
│Agent  Detector      Process Monitor  (0-100 Delta)  (Zero Content)  FW │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## ✨ Key Features

- 🤖 **Multi-Signal AI Agent Detection**: Quantitative confidence scoring (0.0 to 1.0) for Claude Code, Cursor, Copilot, Gemini, Ollama, LM Studio, Aider, Open Interpreter, etc. Generic `node`/`python` runtimes without agent arguments are rejected to prevent false positives.
- 🌳 **Agent Process Trees**: Live recursive process hierarchy mapping showing all child tools spawned by an agent (e.g. `claude -> bash -> curl`). Flags unusual child tools (`powershell -enc`, `nc`, `certutil`).
- 📁 **Sensitive Resource Classifier**: Identifies access to SSH keys (`~/.ssh`), cloud credentials (`~/.aws`, `~/.gcp`), environment files (`.env`), tokens (`.npmrc`), and certificates with **zero file-content reading**.
- 🔗 **Deterministic Correlation Engine**: Detects potential sensitive-data exposure by correlating `[Sensitive File Access]` + `[New External Destination / Transfer Burst Within 10m]`.
- 📊 **Explainable Risk Scoring (0–100)**: Transparent risk scores with itemized factor deltas (+25 secret access, +20 unusual child tool, +15 unseen destination).
- 🧭 **AI Security Investigator**: Optional natural-language explainer (using local Ollama or built-in semantic engine) synthesizing evidence into *Observed Facts*, *Inferences*, *Unknowns*, and *Next Steps*.
- 🌐 **Full Network & Port Monitoring**: Retains all deep network monitoring capabilities (sockets, dev servers, bandwidth traffic, PF / Windows Defender firewall).
- 🧹 **1-Click Privacy & History Purge**: Purge all recorded sessions and security events with a single click.

---

## 🚀 Quick Start

### macOS Installation & Launch

```bash
# Clone and install dependencies
git clone https://github.com/your-username/AgentLens.git
cd AgentLens
npm install

# Option 1: Native macOS GUI Launcher
open "AgentLens Launcher.app"

# Option 2: Finder Double-Click Script
./start.command

# Option 3: Terminal Dev Mode
npm run dev
```

### Windows Installation & Launch

```powershell
# In PowerShell (Run as Administrator for full process mapping)
.\install.ps1

# Launch Agent Lens
npm run dev
```

---

## 📚 Documentation

- [Security Principles & Correlation Engine](docs/SECURITY.md)
- [AI Agent Detection & Supported Agents](docs/AI-AGENTS.md)
- [AI Investigator & Local LLM Integration](docs/LLM.md)
- [Detection Heuristics & Rules](docs/DETECTION.md)
- [Privacy Architecture & Zero-Content Policy](docs/PRIVACY.md)
- [Cross-Platform Implementation](docs/PLATFORM.md)
- [Windows Support Guide](docs/WINDOWS.md)

---

## 📄 License

MIT License. Designed for local security observability and developer privacy.
