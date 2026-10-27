# Antigravity

[![CI](https://github.com/sanjeet98/Vibe-Skill/actions/workflows/ci.yml/badge.svg)](https://github.com/sanjeet98/Vibe-Skill/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

> **Antigravity** is an open-source, full-stack agent skills registry and Abstract Syntax Tree (AST) scaffolding engine designed to empower AI coding agents and human engineers with deterministic, high-fidelity code transformation and modular skill capabilities.

---

## Architecture Overview

Antigravity bridges the gap between probabilistic AI agent reasoning and deterministic codebase modification. While AI agents excel at planning and understanding context, text-based code patching frequently introduces syntax errors, breaks formatting, and risks regressions. Antigravity introduces:

1. **Declarative Skill Manifests**: Standardized format (`skill.yaml`/`skill.json`) specifying agent capabilities, executable codemods, triggers, and execution boundaries.
2. **Deterministic AST Scaffolding**: AST-based transformation engine that manipulates syntactic structures directly (imports, route handlers, middleware, schemas) without destroying formatting or producing invalid syntax.
3. **Skills Registry & Runtime**: Content-addressed registry and isolated sandboxed execution runtime for modular skill packaging, distribution, and verification.
4. **Agent Integration via MCP**: Out-of-the-box Model Context Protocol (MCP) server providing agents with discoverable tools, resources, and live AST execution primitives.

```
                              ┌─────────────────────────────┐
                              │      AI Coding Agent        │
                              │ (Antigravity / Claude / IDE)│
                              └──────────────┬──────────────┘
                                             │  MCP Protocol
                                             ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 Antigravity Platform                                   │
│                                                                                        │
│   ┌────────────────────────┐                    ┌──────────────────────────────────┐   │
│   │    apps/mcp-server     │                    │            apps/cli              │   │
│   │  (Tools, Prompts, SSE) │                    │ (Interactive CLI & Automation)   │   │
│   └───────────┬────────────┘                    └─────────────────┬────────────────┘   │
│               │                                                   │                    │
│               └─────────────────────────┬─────────────────────────┘                    │
│                                         ▼                                              │
│                    ┌─────────────────────────────────────────┐                         │
│                    │          packages/infra-core            │                         │
│                    │    (Registry Client, Cache, Sandbox)    │                         │
│                    └──────┬───────────────────────────┬──────┘                         │
│                           │                           │                                │
│                           ▼                           ▼                                │
│       ┌───────────────────────────────┐   ┌───────────────────────────────┐            │
│       │      packages/ast-engine      │   │       packages/manifest       │            │
│       │ (Syntax Trees, Transforms)    │   │  (Schema, Validation, Types)  │            │
│       └───────────────────────────────┘   └───────────────────────────────┘            │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Workspace Layout

The repository is organized as a high-performance monorepo powered by **pnpm workspaces** and **Turborepo**:

```text
.
├── apps/
│   ├── cli/             # @antigravity/cli - Developer command-line tool
│   └── mcp-server/      # @antigravity/mcp-server - Model Context Protocol server for agents
├── packages/
│   ├── ast-engine/      # @antigravity/ast-engine - AST parsing, manipulation & codemods
│   ├── infra-core/      # @antigravity/infra-core - Registry client, caching, and runtime
│   ├── manifest/        # @antigravity/manifest - Skill specification schemas and validator
│   └── tsconfig/        # @antigravity/tsconfig - Shared strict TypeScript configurations
├── skills/              # Agent skill packages, recipes, and capability bundles
├── docs/
│   ├── phases/          # Master engineering roadmap and phase breakdown
│   │   └── master-roadmap.md
│   └── specs/           # Architecture RFCs and technical specifications
│       ├── 001-manifest-schema.md
│       └── README.md
├── .github/
│   └── workflows/       # GitHub Actions CI/CD workflows
├── pnpm-workspace.yaml  # pnpm workspace definition
├── turbo.json           # Turborepo task pipeline configuration
└── package.json         # Root workspace scripts and dependencies
```

---

## Getting Started

### Prerequisites

- **Node.js**: >= 20.0.0 (Node 22+ recommended)
- **pnpm**: >= 10.0.0

### Installation

Clone the repository and install all workspace dependencies:

```bash
git clone https://github.com/sanjeet98/Vibe-Skill.git
cd Vibe-Skill
pnpm install
```

### Available Scripts

Root scripts are orchestrated via **Turborepo**:

| Script        | Command                | Description                                        |
| :------------ | :--------------------- | :------------------------------------------------- |
| `pnpm build`  | `turbo run build`      | Compiles all packages and applications             |
| `pnpm dev`    | `turbo run dev`        | Runs packages and apps in incremental watch mode   |
| `pnpm lint`   | `turbo run lint`       | Runs type checking and linters across the monorepo |
| `pnpm test`   | `turbo run test`       | Executes unit and integration test suites          |
| `pnpm format` | `prettier --write ...` | Formats all code, docs, and configs with Prettier  |

---

## Roadmap

Detailed engineering milestones and architecture phases are documented in [docs/phases/master-roadmap.md](docs/phases/master-roadmap.md):

- **Phase 1**: Foundation & Monorepo Tooling
- **Phase 2**: Manifest & Specification Standard
- **Phase 3**: AST Scaffolding Engine
- **Phase 4**: Core Infrastructure & Registry Runtime
- **Phase 5**: CLI & Developer Experience
- **Phase 6**: Model Context Protocol (MCP) Server & Ecosystem Integration

---

## License

This project is licensed under the MIT License.
