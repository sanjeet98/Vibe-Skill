# Vibe Skill

[![CI](https://github.com/sanjeet98/Vibe-Skill/actions/workflows/ci.yml/badge.svg)](https://github.com/sanjeet98/Vibe-Skill/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![MCP Enabled](https://img.shields.io/badge/MCP-Compatible-green.svg)](https://modelcontextprotocol.io)

> **Vibe Skill** is an open-source, full-stack agent skills registry and Abstract Syntax Tree (AST) scaffolding engine. It bridges rapid AI agent "vibe-coding" with deterministic, production-grade code synthesis.

---

## 1. Project Vision & Value Proposition

### The Problem with "Vibe Coding"

When AI coding agents (Claude, Cursor, Windsurf) are tasked with integrating complex full-stack capabilities (such as Supabase Auth with SSR middleware, Clerk authentication, or Drizzle ORM schemas), standard probabilistic LLM text generation frequently causes:

- **Syntactic Corruption**: Broken JSX tags, missing braces, or invalid imports.
- **Non-Deterministic Duplication**: Repeated prompt turns duplicate imports, wrap providers redundantly, or collide route handlers.
- **Destructive Overwrites**: Stripping top-of-file directives (`'use client'`, `'use server'`) or removing existing user comments.
- **Integration Gaps**: Missing database migrations, unconfigured `.env` variables, or mismatched package versions.

### The Antigravity Solution

Antigravity replaces brittle text-patching with a **compiler-backed AST scaffolding engine**:

1. **Curated Full-Stack Blueprints**: Production-ready packages containing source templates, database migrations, and agent architectural guidelines (`agent/rules.md`).
2. **Deterministic AST Codemods**: Surgical, non-destructive transformations (`jsx_wrapper`, `named_export`, `re_export`, `middleware_chain`) powered by `ts-morph` and formatted with Prettier.
3. **Guaranteed Idempotency & Rollbacks**: Re-running an install produces zero diffs; any syntax error automatically reverts all files from in-memory snapshots.
4. **Native Agent & Human Interfaces**: Standalone CLI for developers and CI/CD pipelines; Model Context Protocol (MCP) server for Claude Desktop, Cursor, and Windsurf.

```text
┌─────────────────────────────────┐
│     AI Agent / Developer        │ ◄── "Add Supabase Auth with RBAC"
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│       Antigravity Engine        │ ◄── Deterministic AST Scaffolding via skill.json
├─────────────────────────────────┤
│ • Validates framework matrix    │
│ • Injects imports & providers   │
│ • Preserves comments/directives │
│ • Atomic rollback on error      │
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│  Target Production Codebase     │ ◄── 100% syntactically verified & formatted
└─────────────────────────────────┘
```

---

## 2. Monorepo Overview

The repository is structured as a high-performance monorepo powered by **pnpm workspaces** and **Turborepo**:

```text
.
├── apps/
│   ├── cli/                     # Developer CLI binary (antigravity / vibe-skill)
│   └── mcp-server/              # Model Context Protocol stdio server for AI agents
├── packages/
│   ├── ast-engine/              # Deterministic ts-morph AST code transformers
│   ├── infra-core/              # Registry client, local cache, and execution sandbox
│   ├── manifest/                # Zod schemas and runtime validator for skill.json
│   └── tsconfig/                # Strict base TypeScript configuration
├── skills/                      # Canonical reference skills & capability blueprints
│   ├── auth-clerk-nextjs/       # Clerk Authentication for Next.js App Router
│   ├── auth-supabase-rbac/      # Supabase Auth, SSR middleware, & Postgres RBAC
│   └── db-drizzle-pg/           # Drizzle ORM + PostgreSQL client & schemas
├── docs/                        # Architecture specs, master roadmap, and ADRs
└── package.json                 # Root monorepo configuration
```

---

## 3. Quick Start Guide

### Prerequisites

- **Node.js**: `>= 20.0.0` (Node 22+ recommended)
- **pnpm**: `>= 10.0.0` (v12.15+ bundled)

### Installation

Clone the repository and install all workspace dependencies:

```bash
git clone https://github.com/sanjeet98/Vibe-Skill.git
cd Vibe-Skill
pnpm install
```

### Build & Development Scripts

Workspaces are orchestrated via **Turborepo**:

```bash
# Build all packages and applications (tsup & tsc)
pnpm build

# Run incremental watch mode across packages
pnpm dev

# Run strict type checking across monorepo
pnpm lint

# Execute all unit and end-to-end fixture test suites (Vitest)
pnpm test

# Format all code, documentation, and manifests with Prettier
pnpm format
```

---

## 4. CLI Usage Showcase

The CLI is available as `antigravity` (with `vibe-skill` as an alias):

### 4.1 Initialize Project

Detects framework, language, router, and package manager, and initializes the `.antigravity/installed.json` lockfile:

```bash
# In your target project:
antigravity init
# or: vibe-skill init
```

### 4.2 Install a Skill Blueprint

Validates manifest compatibility, copies template files, performs surgical AST injections, appends missing environment keys, and installs npm dependencies:

```bash
# Install canonical reference skill:
antigravity add skills/auth-supabase-rbac

# Dry-run mode (simulate mutations without touching disk):
antigravity add skills/auth-clerk-nextjs --dry-run

# Non-interactive mode (auto-accept prompts):
antigravity add skills/auth-supabase-rbac -y --no-install
```

### 4.3 List Installed Skills

Displays all installed skills recorded in the project lockfile:

```bash
antigravity list
```

---

## 5. Model Context Protocol (MCP) Server Integration

The Antigravity MCP Server allows AI coding assistants (Claude Desktop, Cursor, Claude Code, Windsurf) to discover and install skills programmatically via standard JSON-RPC over `stdio`.

### 5.1 Claude Desktop Configuration

Add the server entry to your Claude Desktop config file:

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "antigravity": {
      "command": "node",
      "args": ["/absolute/path/to/Vibe-Skill/apps/mcp-server/dist/index.js"],
      "env": {
        "ANTIGRAVITY_SKILLS_PATH": "/absolute/path/to/Vibe-Skill/skills"
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
    "antigravity": {
      "command": "node",
      "args": ["./node_modules/@antigravity/mcp-server/dist/index.js"],
      "env": {
        "ANTIGRAVITY_SKILLS_PATH": "./skills"
      }
    }
  }
}
```

### 5.3 Available MCP Tools

- `list_available_skills`: Returns a catalog of all registered skill blueprints, supported frameworks, and required environment variables.
- `inspect_skill(skillId)`: Returns full `skill.json` manifest and architectural rules markdown (`agent/rules.md`).
- `install_skill(projectPath, skillId, options)`: Programmatically executes the 9-stage AST injection and file placement pipeline.

---

## 6. Skill Authoring & Contribution

Every Antigravity skill package resides in `skills/<skill-id>` and requires:

```text
skills/<skill-id>/
├── skill.json              # Declarative manifest (Zod validated)
├── template/               # Components, helpers, and middleware to place
│   ├── components/
│   └── lib/
├── schema/                 # SQL migrations or ORM schemas
│   └── migration.sql
├── agent/
│   └── rules.md            # Architectural guidelines for AI agents
└── tests/                  # Verification test fixtures
```

### Example `skill.json`:

```json
{
  "schemaVersion": "1.0.0",
  "id": "auth-supabase-rbac",
  "name": "Supabase Auth with RBAC",
  "version": "1.0.0",
  "description": "Production-grade Supabase Auth with SSR middleware and RBAC.",
  "compatibility": {
    "framework": "nextjs",
    "language": "typescript",
    "router": "app-router"
  },
  "dependencies": {
    "npm": {
      "@supabase/supabase-js": "^2.45.0",
      "@supabase/ssr": "^0.5.0"
    }
  },
  "env": [
    { "key": "NEXT_PUBLIC_SUPABASE_URL", "required": true, "secret": false },
    {
      "key": "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "required": true,
      "secret": true
    },
    { "key": "SUPABASE_SERVICE_ROLE_KEY", "required": true, "secret": true }
  ],
  "injections": [
    {
      "type": "jsx_wrapper",
      "targetFile": "src/app/layout.tsx",
      "import": {
        "identifier": "AuthProvider",
        "module": "@/components/auth-provider"
      },
      "wrapperComponent": "AuthProvider"
    }
  ],
  "agentContext": {
    "rulesFile": "agent/rules.md"
  }
}
```

---

## 7. Architecture & Governance Documentation

For complete technical specifications, see:

- [**`ARCHITECTURE.md`**](ARCHITECTURE.md): System design, component breakdown, and tech stack rationale.
- [**`DESIGN.md`**](DESIGN.md): Deterministic AST scaffolding philosophy and idempotency guarantees.
- [**`FLOW.md`**](FLOW.md): 9-stage installation lifecycle state machine and MCP protocol sequence diagrams.
- [**`DECISIONS.md`**](DECISIONS.md): Architectural Decision Records (ADR-001 through ADR-004).
- [**`AGENTS.md`**](AGENTS.md): Multi-agent taxonomy, tool invocation constraints, and context economics.
- [**`RULES.md`**](RULES.md): Strict TypeScript standards, AST transformation invariants, and Conventional Commits.
- [**`MEMORY.md`**](MEMORY.md): State persistence, workspace lockfiles, and checkpoint rollback ledger.

---

## 8. License

This project is licensed under the [MIT License](LICENSE).
