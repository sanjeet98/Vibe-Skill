# Antigravity (Vibe Skill)

[![CI](https://github.com/sanjeet98/Vibe-Skill/actions/workflows/ci.yml/badge.svg)](https://github.com/sanjeet98/Vibe-Skill/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript: Strict](https://img.shields.io/badge/TypeScript-Strict%205.8-blue.svg)](packages/tsconfig/base.json)
[![Turborepo](https://img.shields.io/badge/Turborepo-v2.4-black.svg)](https://turbo.build/repo)

> **Antigravity** (Vibe Skill) is an open-source, full-stack agent skills registry and Abstract Syntax Tree (AST) scaffolding engine. It bridges high-level AI agent reasoning ("vibe-coding") with deterministic, compiler-verified code manipulation.

---

## 1. Project Vision & Value Proposition

### The Problem: Vibe Coding Breaks at Scale

AI coding assistants (Claude, Cursor, Windsurf, Copilot) excel at natural-language understanding, algorithmic planning, and boilerplate generation. However, when instructed to inject complex full-stack capabilities (such as Supabase Auth with SSR middleware, Clerk authentication, or Drizzle ORM schemas) into established codebases, text-generating LLMs frequently fail:

- **Syntax Corruption**: Missing braces, unclosed JSX elements, or malformed parameter lists.
- **Import Duplication**: Generating duplicate import statements or conflicting symbols.
- **Directive Detachment**: Inadvertently stripping `'use client'` or `'use server'` directives during string replacements.
- **Non-Atomic Breakages**: Leaving the codebase in a half-configured, unbuildable state when an error occurs.

### The Antigravity Solution

Antigravity enforces a strict separation: **AI agents handle intent and semantic planning; the Antigravity AST Engine handles code compilation and syntax tree mutations**.

- **Deterministic Code Scaffolding > Probabilistic Code Generation**: Surgical node-level AST insertions instead of blind string replacements.
- **100% Idempotent**: Running a skill installation repeatedly will never duplicate imports, JSX providers, or barrel re-exports.
- **Atomic Transactions & Instant Rollback**: Changes are validated against compiler syntax diagnostics before saving; any error triggers an instant revert.
- **Zero-Trust Declarative Manifests**: Skills declare what they inject via `skill.json` without running unsandboxed arbitrary shell scripts.
- **Dual Interface**: Native CLI for human developers and CI pipelines; Model Context Protocol (MCP) server for agent IDEs.

---

## 2. Monorepo Architecture Overview

The repository is organized as a high-performance monorepo powered by **pnpm workspaces** and **Turborepo**:

```text
.
├── apps/
│   ├── cli/                     # @vibe-skill/cli - Human developer CLI (bin: vibe-skill, antigravity)
│   └── mcp-server/              # @vibe-skill/mcp-server - Model Context Protocol stdio server
├── packages/
│   ├── ast-engine/              # @vibe-skill/ast-engine - ts-morph AST codemods & rollback guardrails
│   ├── infra-core/              # @vibe-skill/infra-core - Registry client, caching, and runtime
│   ├── manifest/                # @vibe-skill/manifest - Skill specification Zod schemas & validator
│   └── tsconfig/                # @vibe-skill/tsconfig - Shared strict TypeScript configurations
├── skills/                      # Canonical reference skill packages & blueprints
│   ├── auth-clerk-nextjs/       # Clerk Auth App Router integration
│   ├── auth-supabase-rbac/      # Supabase Auth, SSR middleware, & Postgres RBAC
│   └── db-drizzle-pg/           # Drizzle ORM + Postgres schema & client
├── docs/                        # Architecture specifications and engineering roadmaps
├── ARCHITECTURE.md              # System design & component interaction topology
├── DESIGN.md                    # Core principles, idempotency, & non-destructive mutations
├── FLOW.md                      # 9-stage installation lifecycle & MCP sequence diagrams
├── DECISIONS.md                 # Architecture Decision Records (ADRs)
├── AGENTS.md                    # Multi-agent role taxonomy & tool constraints
├── RULES.md                     # Strict TypeScript, Git, & error handling standards
└── MEMORY.md                    # Workspace lockfile & rollback checkpoint ledger
```

---

## 3. Quick Start Guide

### Prerequisites

- **Node.js**: `>= 20.0.0` (Node 22+ recommended)
- **pnpm**: `>= 10.0.0` (Enforced via `packageManager: "pnpm@12.15.0"`)

### Installation & Build

```bash
# 1. Clone repository
git clone https://github.com/sanjeet98/Vibe-Skill.git
cd Vibe-Skill

# 2. Install dependencies across all workspaces
pnpm install

# 3. Build all packages and CLI/MCP executables with Turborepo
pnpm build
```

### Development Scripts

| Command             | Action                                                                     |
| :------------------ | :------------------------------------------------------------------------- |
| `pnpm build`        | Compiles all packages and standalone binaries using cached Turborepo tasks |
| `pnpm dev`          | Starts incremental watch mode across all packages                          |
| `pnpm test`         | Runs complete Vitest test suites (49+ unit & e2e fixture tests)            |
| `pnpm lint`         | Runs `tsc --noEmit` strict type checking across all 6 workspaces           |
| `pnpm format`       | Formats all code, markdown, and JSON files using Prettier                  |
| `pnpm format:check` | Asserts Prettier code formatting compliance in CI                          |

---

## 4. CLI Usage Showcase

The platform ships an interactive developer CLI (`vibe-skill`, aliased to `antigravity`):

```bash
# Display help & options
vibe-skill --help
```

### 4.1 Initialize Project (`vibe-skill init`)

Detects framework, language, router, and package manager, and initializes the workspace lockfile:

```bash
vibe-skill init
```

```text
◆  Vibe Skill CLI
│  Project detected: my-next-app v0.1.0
│  Framework:       nextjs
│  Language:        typescript
│  Router:          app-router
│  Package Manager: pnpm
│  Git Repository:  yes
◇  Initialized .vibe-skill/installed.json lockfile.
└  Vibe Skill is ready. Run vibe-skill add <skill> to install skills.
```

### 4.2 Install Skill (`vibe-skill add <skill>`)

Validates compatibility, injects imports and providers via AST, copies schemas, and provisions `.env.local`:

```bash
# Install by local path or registry identifier
vibe-skill add skills/auth-supabase-rbac

# Non-interactive / CI execution
vibe-skill add skills/auth-clerk-nextjs -y --no-install
```

### 4.3 List Installed Skills (`vibe-skill list`)

Inspects `.vibe-skill/installed.json` and outputs active capabilities:

```bash
vibe-skill list
```

```text
◆  Vibe Skill Installed Skills
│  Found 2 installed skill(s):
│
◇  1. Supabase Auth with RBAC (auth-supabase-rbac@1.0.0) - installed 10/28/2026
│     Source: skills/auth-supabase-rbac | Injections: 2
◇  2. Clerk Auth Integration (auth-clerk-nextjs@1.0.0) - installed 10/28/2026
│     Source: skills/auth-clerk-nextjs | Injections: 1
└  Use vibe-skill add <skill> to add more skills.
```

---

## 5. Model Context Protocol (MCP) Server Integration

The `@vibe-skill/mcp-server` enables AI coding agents (Claude Desktop, Cursor, Claude Code, Windsurf) to discover, inspect, and install verified skills natively over `stdio`.

### 5.1 Claude Desktop Configuration

Add the server entry to your Claude Desktop configuration file:

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "vibe-skill": {
      "command": "node",
      "args": ["/absolute/path/to/Vibe-Skill/apps/mcp-server/dist/index.js"],
      "env": {
        "VIBE_SKILLS_PATH": "/absolute/path/to/Vibe-Skill/skills"
      }
    }
  }
}
```

### 5.2 Cursor IDE Configuration

Create or edit `.cursor/mcp.json` at the root of your workspace:

```json
{
  "mcpServers": {
    "vibe-skill": {
      "command": "node",
      "args": ["/absolute/path/to/Vibe-Skill/apps/mcp-server/dist/index.js"],
      "env": {
        "VIBE_SKILLS_PATH": "./skills"
      }
    }
  }
}
```

### 5.3 Claude Code CLI Configuration

Register via the terminal:

```bash
claude mcp add vibe-skill -- node /absolute/path/to/Vibe-Skill/apps/mcp-server/dist/index.js
```

### 5.4 Available MCP Tools

- **`list_available_skills`**: Returns catalog of skills, tags, framework requirements, and required environment variables.
- **`inspect_skill(skillId)`**: Returns detailed `skill.json` manifest and architectural rules markdown (`agent/rules.md`).
- **`install_skill(projectPath, skillId, options)`**: Programmatically executes deterministic AST injections, copies schema assets, provisions `.env.local` keys, and returns structured agent guidance.

---

## 6. Contribution & Skill Authoring

We welcome community contributions for new agent skills, ORM blueprints, and auth integrations.

### Authoring a New Skill Package

Create a new directory under `skills/<skill-id>/`:

```text
skills/my-new-skill/
├── skill.json                   # Manifest conforming to @vibe-skill/manifest
├── template/                    # Code templates & components to place
│   ├── components/
│   └── lib/
├── schema/                      # Database migrations or ORM tables (.sql, .ts)
└── agent/
    └── rules.md                 # Agent architectural rules & best practices
```

### Testing Your Skill Locally

Verify that your manifest adheres strictly to Zod validation:

```bash
# Run manifest validation tests
pnpm --filter @vibe-skill/manifest test

# Test end-to-end installation against local fixture
node apps/cli/dist/index.js add skills/my-new-skill --cwd apps/cli/fixtures/sample-app --dry-run
```

---

## 7. Operational Documentation & Governance

For in-depth architectural and operational specifications, consult:

- [`ARCHITECTURE.md`](ARCHITECTURE.md): System topology, component breakdown, and technology stack.
- [`DESIGN.md`](DESIGN.md): Idempotency guarantees, non-destructive mutation, and zero-trust manifests.
- [`FLOW.md`](FLOW.md): 9-stage installation lifecycle and MCP agent interaction flow.
- [`DECISIONS.md`](DECISIONS.md): Architectural Decision Records (ADRs).
- [`AGENTS.md`](AGENTS.md): Multi-agent role taxonomy, tool constraints, and context economics.
- [`RULES.md`](RULES.md): Strict TypeScript standards, AST safety, and conventional commits.
- [`MEMORY.md`](MEMORY.md): Workspace lockfile schema and rollback checkpoint ledger.

---

## 8. License

This project is licensed under the [MIT License](LICENSE).
