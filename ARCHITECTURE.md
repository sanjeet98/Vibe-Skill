# Vibe Skill: Architecture & System Overview

> **Vibe Skill** is an open-source, full-stack agent skills registry and Abstract Syntax Tree (AST) scaffolding engine. It bridges high-level AI agent reasoning ("vibe-coding") with deterministic, compiler-verified codebase transformations.

---

## 1. System Overview

### The Dilemma of "Vibe-Coding"

Modern AI coding agents (Claude, Cursor, Windsurf, Copilot Workspace) excel at holistic planning, semantic reasoning, and contextual comprehension. However, when instructed to integrate complex full-stack capabilities (such as Supabase Auth with SSR middleware, Clerk authentication, or Drizzle ORM schemas), standard LLM-based text generation frequently introduces critical defects:

1. **Syntactic Corruption**: Unbalanced JSX/TSX tags, missing curly braces, or invalid nested statements.
2. **Import Hallucination & Duplication**: Duplicate imports, conflicting namespace imports, or imported symbols from non-existent subpaths.
3. **Destructive Text Rewrites**: Naive string search-and-replace often strips user comments, drops top-of-file directives (such as `'use client'` or `'use server'`), and formats files inconsistently.
4. **Integration Fragmentation**: An agent may generate application code but forget database migrations, fail to configure required environment variables, or install mismatched dependency versions.

### The Vibe Skill Bridge

Vibe Skill solves this problem by decoupling **high-level agent intent** from **low-level code synthesis**:

```
┌─────────────────────────────────┐
│     AI Agent / Developer        │ ◄── Identifies intent: "Install Supabase Auth RBAC"
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│       Vibe Skill Platform       │ ◄── Enforces deterministic rules via skill.json
├─────────────────────────────────┤
│ • Validates compatibility       │
│ • Mutates syntax trees safely   │
│ • Preserves user directives     │
│ • Reversible on error           │
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│  Target Production Codebase     │ ◄── 100% syntactically valid, formatted, and tested
└─────────────────────────────────┘
```

Rather than letting the LLM regenerate entire files as free-form strings, agents discover packaged, battle-tested capabilities ("Skills") from a registry and invoke deterministic AST codemods that execute directly against the codebase.

---

## 2. Monorepo Component Breakdown

The platform is structured as a modular TypeScript monorepo managed with **pnpm workspaces** and **Turborepo**:

```text
.
├── apps/
│   ├── cli/                     # @vibe-skill/cli (binary: vibe-skill)
│   └── mcp-server/              # @vibe-skill/mcp-server (stdio Model Context Protocol)
├── packages/
│   ├── ast-engine/              # @vibe-skill/ast-engine (ts-morph AST code mutators)
│   ├── infra-core/              # @vibe-skill/infra-core (registry client, cache, sandbox)
│   ├── manifest/                # @vibe-skill/manifest (skill.json Zod schemas & validator)
│   └── tsconfig/                # @vibe-skill/tsconfig (shared strict compiler configs)
├── skills/                      # Canonical reference skill packages & blueprints
│   ├── auth-clerk-nextjs/       # Clerk Auth App Router integration
│   ├── auth-supabase-rbac/      # Supabase Auth, SSR middleware, & Postgres RBAC
│   └── db-drizzle-pg/           # Drizzle ORM + Postgres schema & client
├── docs/                        # Architecture specs, roadmaps, and guides
└── package.json                 # Root monorepo configuration
```

### Detailed Component Responsibilities

| Package / Application     | Scope / Purpose                         | Key Responsibilities                                                                                                                                                                                                                                                                                                                               |
| :------------------------ | :-------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`apps/cli`**            | Developer Experience & Local Automation | • Implements the `vibe-skill` CLI.<br/>• Commands: `init` (detect environment), `add` (install skill), `list` (show installed skills).<br/>• Prompts human developers for required environment variables with `@clack/prompts`.<br/>• Automatically runs package managers (`pnpm`, `npm`, `yarn`, `bun`).                                          |
| **`apps/mcp-server`**     | AI Agent Integration                    | • Implements an MCP-compliant server using `@modelcontextprotocol/sdk` over `stdio`.<br/>• Exposes tools: `list_available_skills`, `inspect_skill`, and `install_skill`.<br/>• Allows AI agents (Cursor, Claude Code, Windsurf) to query catalog blueprints and invoke AST injections programmatically.                                            |
| **`packages/manifest`**   | Specification & Validation              | • Single source of truth for the `skill.json` schema.<br/>• Zod schemas validating kebab-case IDs, SemVer strings, framework compatibility matrices, environment variable definitions, and injection discriminators.<br/>• Exports TypeScript types (`SkillManifest`, `ASTInjection`, `CompatibilityConfig`).                                      |
| **`packages/ast-engine`** | Deterministic Code Transformation       | • Wraps `ts-morph` to perform atomic, non-destructive TypeScript/TSX transformations.<br/>• Core transformers: `import-injector`, `jsx-wrapper-injector`, `export-reexport-injector`, and `middleware-injector`.<br/>• Features automatic rollback guardrails: on syntax error or diagnostic failure, reverts all mutated files to original state. |
| **`packages/infra-core`** | Runtime & Registry Client               | • Manages remote registry communication, skill resolution, and bundle tarball fetching.<br/>• Handles content-addressable local storage and SHA-256 verification.<br/>• Sandboxed execution runtime for pre- and post-installation lifecycle hooks.                                                                                                |
| **`skills/`**             | Canonical Blueprints                    | • Production-ready, verified skill definitions.<br/>• Contains `skill.json`, code templates, database migrations (`.sql` / `.ts`), agent coding rules (`agent/rules.md`), and verification test fixtures.                                                                                                                                          |

---

## 3. Component Interaction Diagram

The diagram below illustrates how an external AI agent or human software engineer initiates skill discovery, schema validation, AST code transformation, and file system synchronization:

```
                      ┌────────────────────────────────────────┐
                      │             User / Agent               │
                      │  (Human Engineer / Claude / Cursor)   │
                      └──────────────┬──────────────────┬──────┘
                                     │                  │
                CLI Command (Terminal)│                  │ MCP Protocol (JSON-RPC stdio)
                                     ▼                  ▼
                         ┌─────────────────┐  ┌─────────────────┐
                         │    apps/cli     │  │ apps/mcp-server │
                         └────────┬────────┘  └────────┬────────┘
                                  │                    │
                                  └──────────┬─────────┘
                                             │
                                             ▼
                             ┌───────────────────────────────┐
                             │       packages/manifest       │
                             │  (Zod Schema & Compatibility) │
                             └───────────────┬───────────────┘
                                             │ Validated Manifest
                                             ▼
                             ┌───────────────────────────────┐
                             │      packages/infra-core      │
                             │ (Registry, Cache, Resolution) │
                             └───────────────┬───────────────┘
                                             │
                     ┌───────────────────────┴───────────────────────┐
                     │                                               │
                     ▼                                               ▼
     ┌───────────────────────────────┐               ┌───────────────────────────────┐
     │      packages/ast-engine      │               │          File System          │
     │  (ts-morph AST Transformers)  │               │      (Templates & Env)        │
     └───────────────┬───────────────┘               └───────────────┬───────────────┘
                     │                                               │
                     │  1. In-memory Syntax Tree                     │  1. Copy Template Files
                     │  2. Inject Imports & JSX                      │  2. Append Missing .env Keys
                     │  3. Verify Diagnostics                       │  3. Update Lockfile
                     │  4. Prettier Formatting                       │
                     └───────────────────────┬───────────────────────┘
                                             │
                                             ▼
                             ┌───────────────────────────────┐
                             │     Target User Codebase      │
                             │ (Next.js / Vite / TS Project) │
                             └───────────────┬───────────────┘
                                             │
                                             ▼
                             ┌───────────────────────────────┐
                             │     Package Manager & Git     │
                             │  (pnpm install, git commit)   │
                             └───────────────────────────────┘
```

---

## 4. Technology Stack & Architectural Rationale

| Layer / Technology      | Choice                            | Architectural Rationale                                                                                                                                                                                                                    |
| :---------------------- | :-------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Language**            | **TypeScript 5.8+** (Strict mode) | Strict type checking (`ES2022`, `NodeNext` module resolution) prevents null pointer exceptions, unhandled promises, and undefined manifest access at compile time.                                                                         |
| **AST Transformation**  | **ts-morph**                      | Unlike regex (fragile) or Babel/Recast (strips comments or drops JSX directives), `ts-morph` provides a rich object-oriented wrapper around the TypeScript compiler API, retaining exact whitespace, comments, and top-of-file directives. |
| **Schema Validation**   | **Zod 3 / 4**                     | Serves as the single source of truth for both static TypeScript types (`z.infer`) and runtime validation of untrusted JSON manifests.                                                                                                      |
| **Monorepo Manager**    | **pnpm Workspaces**               | Symlink-based node_modules structure guarantees strict dependency isolation, prevents phantom dependencies, and maximizes disk efficiency across packages.                                                                                 |
| **Build & Task Runner** | **Turborepo**                     | Topological pipeline scheduling with local file-hash caching ensures fast, incremental `build`, `lint`, and `test` executions across all monorepo workspaces.                                                                              |
| **CLI Framework**       | **Commander + @clack/prompts**    | `Commander` provides standardized POSIX argument parsing and subcommands, while `@clack/prompts` and `picocolors` provide beautiful, interactive terminal interfaces.                                                                      |
| **Agent Interface**     | **@modelcontextprotocol/sdk**     | Standardized JSON-RPC protocol supported natively by Claude Desktop, Cursor, Claude Code, and Windsurf, allowing agents to call tools without custom plugins.                                                                              |
| **Formatting**          | **Prettier**                      | Run automatically after AST transformations to guarantee that modified code matches the repository's formatting rules without manual intervention.                                                                                         |
| **Test Runner**         | **Vitest**                        | Native ESM test execution with instant startup, in-source testing capabilities, and parallel execution for unit and end-to-end fixture suites.                                                                                             |
