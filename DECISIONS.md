# Antigravity: Architecture Decision Records (ADRs)

This document records the foundational architectural decisions made for the Antigravity (Vibe Skill) platform. Each record outlines the context, rationale, and consequences of key technical choices.

---

## Index of Architectural Decision Records

- [ADR-001: Use `ts-morph` over Regex or Babel for AST Transformations](#adr-001-use-ts-morph-over-regex-or-babel-for-ast-transformations)
- [ADR-002: Use `pnpm` Workspaces and `Turborepo` for Monorepo Orchestration](#adr-002-use-pnpm-workspaces-and-turborepo-for-monorepo-orchestration)
- [ADR-003: Use `Zod` as Single Source of Truth for Manifest Validation and Types](#adr-003-use-zod-as-single-source-of-truth-for-manifest-validation-and-types)
- [ADR-004: Dual-Interface Access via Standalone CLI and stdio MCP Server](#adr-004-dual-interface-access-via-standalone-cli-and-stdio-mcp-server)

---

## ADR-001: Use `ts-morph` over Regex or Babel for AST Transformations

- **Status:** Accepted
- **Date:** 2026-10-28
- **Deciders:** Antigravity Systems Architecture Team

### Context

Antigravity must perform deterministic, non-destructive code modifications on existing TypeScript and TSX files (e.g., adding imports, wrapping root layout components in providers, re-exporting modules in barrel files).

We evaluated four candidate approaches:

1. **Regular Expressions / String Search-and-Replace**: Highly fragile. Fails on multiline imports, varying formatting, nested JSX tags, and aliased imports. Can easily corrupt code.
2. **Babel / Recast**: Powerful parser, but often alters formatting, strips inline comments, or detaches top-of-file compiler directives (such as `'use client'` or `'use server'`).
3. **Raw TypeScript Compiler API (`typescript`)**: Fully accurate, but verbose, imperative, and lacks convenient node manipulation and text-replacement methods.
4. **`ts-morph`**: A robust, TypeScript-compiler-backed AST manipulation library providing intuitive navigation, surgical node-level mutations, comment retention, and diagnostic verification.

### Decision

We chose **`ts-morph`** as the foundational AST manipulation engine for `@vibe-skill/ast-engine`.

### Consequences

#### Positive

- **Syntactic Precision**: Operates on verified compiler AST nodes rather than text guesses.
- **Directive Preservation**: Comments, JSDocs, and `'use client'`/`'use server'` directives remain anchored in their correct positions.
- **Diagnostic Verification**: Modified source files can be checked immediately for compiler syntax diagnostics prior to writing to disk.
- **Idempotency**: Allows easy traversal of import declarations and JSX trees to verify if a symbol or provider tag already exists.

#### Negative & Mitigations

- _Heavier footprint_: `ts-morph` bundles TypeScript compiler internals (~20MB package size).
- _Mitigation_: Isolate `ts-morph` completely within `@vibe-skill/ast-engine`; neither the manifest validator nor consumer apps need to bundle it.

---

## ADR-002: Use `pnpm` Workspaces and `Turborepo` for Monorepo Orchestration

- **Status:** Accepted
- **Date:** 2026-10-28
- **Deciders:** Antigravity Systems Architecture Team

### Context

Antigravity is composed of multiple interrelated packages and applications: core schemas (`manifest`), the code mutator (`ast-engine`), runtime infrastructure (`infra-core`), user interfaces (`cli`, `mcp-server`), and reference capability blueprints (`skills/`).

We required a monorepo tooling stack that provides:

1. Strict dependency isolation to prevent phantom dependencies.
2. Fast workspace package linking without published npm tarballs.
3. Content-hashed task caching across `build`, `lint`, and `test` pipelines.

### Decision

We adopted **`pnpm` Workspaces** paired with **`Turborepo`** (v2+).

### Consequences

#### Positive

- **Strict Symlinks**: `pnpm`'s content-addressable storage and isolated `node_modules` structure prevents phantom dependencies between packages.
- **Fast Local Builds**: Turborepo caches pipeline tasks (`turbo run build test lint`). Unchanged packages replay from cache in milliseconds.
- **Single Lockfile**: All packages share a single, unified `pnpm-lock.yaml` ensuring dependency determinism across CI and local environments.

#### Negative & Mitigations

- _Prerequisite requirement_: Developers must have `pnpm` installed rather than default `npm`.
- _Mitigation_: Specify `packageManager: "pnpm@12.15.0"` in root `package.json` and document installation clearly in `README.md`.

---

## ADR-003: Use `Zod` as Single Source of Truth for Manifest Validation and Types

- **Status:** Accepted
- **Date:** 2026-10-28
- **Deciders:** Antigravity Systems Architecture Team

### Context

Skill manifests (`skill.json`) define the metadata, framework compatibility, environment variables, and AST injections of a skill. Manifests may originate from local files, remote registries, or user-authored blueprints.

Relying solely on static TypeScript interfaces provides zero runtime safety when parsing untrusted JSON. Conversely, maintaining both JSON Schema files and TypeScript definitions leads to schema drift and maintenance overhead.

### Decision

We adopted **`Zod`** as the single source of truth for all manifest schema definitions in `@vibe-skill/manifest`:

- The schema is declared declaratively with `SkillManifestSchema`.
- TypeScript types are dynamically inferred with `z.infer<typeof SkillManifestSchema>`.
- Runtime validation is performed via `validateManifest()` and `assertValidManifest()`.

### Consequences

#### Positive

- **Zero Drift**: Type definitions and runtime validation schemas are always 100% in sync.
- **Detailed Error Path Reporting**: Zod issues are transformed into human- and agent-readable messages pinpointing exact JSON paths (e.g. `injections.0.wrapperComponent: Required`).
- **Strict Enforcements**: Built-in refinement rules validate SemVer compatibility, kebab-case identifier formats, and discriminated injection unions.

#### Negative & Mitigations

- _Bundle size_: Adds Zod dependency to manifest consumers.
- _Mitigation_: Zod is lightweight (~12KB gzipped) and already ubiquitous in modern TypeScript ecosystems.

---

## ADR-004: Dual-Interface Access via Standalone CLI and stdio MCP Server

- **Status:** Accepted
- **Date:** 2026-10-28
- **Deciders:** Antigravity Systems Architecture Team

### Context

Antigravity serves two primary user categories:

1. **Human Software Engineers**: Operating in terminal environments, running interactive local commands or CI/CD automated setup scripts.
2. **AI Coding Agents**: Operating in modern AI-integrated IDEs (Claude Desktop, Cursor, Claude Code, Windsurf) requiring structured JSON-RPC tool-calling interfaces without manual terminal interaction.

Creating only a CLI would force AI agents to run shell subprocesses, parse noisy stdout, and deal with unhandled terminal prompts. Creating only an MCP server would exclude human engineers and automated CI workflows.

### Decision

We established a **Dual-Interface Architecture**:

- **`apps/cli` (`vibe-skill` / `antigravity`)**: Provides human-friendly interactive terminal prompts with `@clack/prompts`, colored logs, and automated package manager invocation.
- **`apps/mcp-server` (`vibe-skill-mcp-server`)**: Exposes native JSON-RPC tools (`list_available_skills`, `inspect_skill`, `install_skill`) over `stdio` via `@modelcontextprotocol/sdk`.

Both interfaces are thin presentation layers that delegate all core logic directly to the shared `@vibe-skill/ast-engine` and `@vibe-skill/manifest` libraries.

### Consequences

#### Positive

- **Unified Domain Core**: Bug fixes and enhancements in `ast-engine` immediately benefit both the CLI and AI agents.
- **Native Agent Integration**: Agents interact via standard MCP tools, allowing seamless integration with Claude, Cursor, and Windsurf without custom plugin authoring.
- **Superior DX**: Humans get clean prompts, progress spinners, and automatic package installation.

#### Negative & Mitigations

- _Two application entry points to maintain_.
- _Mitigation_: Keep `apps/cli` and `apps/mcp-server` lean, ensuring zero business logic duplication between them.
