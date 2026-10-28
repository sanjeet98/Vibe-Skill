# Antigravity: Agent Operational Taxonomy & Behavioral Governance

This document establishes the behavioral guidelines, role taxonomy, tool invocation constraints, and context economics governing AI coding agents operating within or interacting with the **Antigravity (Vibe Skill)** ecosystem.

---

## 1. Agent Taxonomy & Role Separation

In complex codebases, allowing a single generalist LLM prompt to simultaneously plan features, write raw file edits, manage cloud infrastructure, and verify builds causes context confusion and code corruption. Antigravity establishes four specialized agent roles with clear operational boundaries.

```text
                             ┌─────────────────────────────────┐
                             │       Orchestrator Agent        │
                             │  (Intent, Discovery, Planning)  │
                             └────────────────┬────────────────┘
                                              │
                     ┌────────────────────────┼────────────────────────┐
                     │                        │                        │
                     ▼                        ▼                        ▼
      ┌─────────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐
      │   AST Injection Agent   │  │   Infra Provisioner │  │   Verification &    │
      │   (Compiler Codemods)   │  │ (Env, DB, Keys)     │  │   Quality Agent     │
      └─────────────────────────┘  └─────────────────────┘  └─────────────────────┘
```

### 1.1 Orchestrator Agent

- **Primary Responsibility**: High-level problem formulation, repository context analysis, skill discovery, and multi-agent coordination.
- **Capabilities**:
  - Inspects project dependencies (`package.json`, `pyproject.toml`) and detects framework (`nextjs`, `vite`, `remix`, `fastapi`).
  - Calls `list_available_skills` to discover relevant blueprints in the catalog.
  - Calls `inspect_skill(skillId)` to review capability requirements and architectural constraints in `agent/rules.md`.
  - Generates an actionable execution plan and delegates specialized subtasks.
- **Prohibitions**: Must **never** directly patch code or write files to disk.

### 1.2 AST Injection Agent

- **Primary Responsibility**: Deterministic code transformation and non-destructive syntax tree mutation.
- **Capabilities**:
  - Interacts with `@vibe-skill/ast-engine` via the MCP `install_skill` tool or local engine primitives.
  - Injects named imports without duplicating symbols or detaching top-of-file directives (`'use client'`, `'use server'`).
  - Wraps root layouts (`RootLayout` in `src/app/layout.tsx`) in application context providers.
  - Appends schema re-exports into central barrel indexes (`src/db/schema/index.ts`).
  - Enforces Prettier formatting on all mutated files.
- **Prohibitions**: Must **never** perform naive regex or search-and-replace text substitutions on files that have dedicated AST codemod transformers.

### 1.3 Infrastructure Provisioner Agent

- **Primary Responsibility**: Environment variables, cloud connectivity credentials, and database migration execution.
- **Capabilities**:
  - Scans `.env.example`, `.env.local`, and `.env` to detect missing required keys defined in `manifest.env`.
  - Prompts developer or orchestrator for secret credentials (e.g., Supabase service role key, Clerk secret key).
  - Appends structured, commented variable blocks without overwriting existing keys.
  - Executes database schema migrations (`pnpm drizzle-kit push`, `supabase db push`, `npx prisma migrate dev`).
- **Prohibitions**: Must **never** log or leak secret values into agent reasoning traces or public chat outputs.

### 1.4 Verification & Quality Agent

- **Primary Responsibility**: Automated validation, syntax diagnostics, type checking, and test execution.
- **Capabilities**:
  - Executes compiler verification (`pnpm lint`, `tsc --noEmit`).
  - Executes unit and integration test fixtures via Vitest (`pnpm test`).
  - Verifies that newly placed routes, components, and injected providers render without syntax errors.
  - Signals the Orchestrator to commit upon green verification, or trigger atomic rollback upon failure.
- **Prohibitions**: Must **never** mark a task complete without running and verifying compiler diagnostics.

---

## 2. Tool Invocation Constraints

To preserve repository stability, agents interacting with Antigravity must strictly adhere to the following tool invocation policies:

### 2.1 MCP Tools vs. Direct File Edits

| Operation                 | Allowed Tooling           | Prohibited Tooling             | Rationale                                                                    |
| :------------------------ | :------------------------ | :----------------------------- | :--------------------------------------------------------------------------- |
| **Skill Discovery**       | `list_available_skills`   | Grepping arbitrary directories | Discovers only validated manifests matching project compatibility.           |
| **Architecture Review**   | `inspect_skill`           | Reading arbitrary prompt files | Returns canonical manifest schema, injection plans, and architectural rules. |
| **Installing Capability** | `install_skill`           | Manual copy/pasting files      | Invokes atomic AST mutations, schema placement, and rollback transactions.   |
| **Custom Feature Code**   | Direct file editing (IDE) | Misusing skill installers      | Domain-specific application code belongs in developer-authored files.        |

### 2.2 Prohibited Patterns

1. **No Blind String Replacement**:

   ```typescript
   // ❌ STRICTLY FORBIDDEN: Can corrupt JSX nesting and drop 'use client'
   content.replace("<body>", "<body><AuthProvider>");

   // ✅ MANDATORY: Use the AST Engine via install_skill
   await handleInstallSkill(projectPath, "auth-supabase-rbac");
   ```

2. **No Unchecked Package Installation**:
   Agents must never run unconstrained `npm install <pkg>` commands with `*` or `latest` tags. Dependencies must strictly adhere to the SemVer ranges declared in `manifest.dependencies.npm`.

3. **No Phantom Lockfile Modifications**:
   The `.vibe-skill/installed.json` (or legacy `.antigravity/installed.json`) lockfile is managed exclusively by the engine. Agents must never manually modify lockfile JSON contents.

---

## 3. Context Economics & Token Budget Optimization

LLM context windows are finite and computationally expensive. Excessive file dumping degrades reasoning quality and increases inference latency. Agents must practice strict context stewardship:

### 3.1 Progressive Context Disclosure

Agents must never load the entirety of a skill package or monorepo into the system prompt:

1. **Tier 1 (Catalog Scan)**: Call `list_available_skills` to retrieve compact summaries (`id`, `name`, `version`, `framework`, `requiredEnvVars`).
   - _Token Cost_: ~150 tokens per skill.
2. **Tier 2 (Targeted Inspection)**: Call `inspect_skill(skillId)` _only_ for the selected skill to obtain its manifest schema and `rules.md`.
   - _Token Cost_: ~1,000 tokens.
3. **Tier 3 (Execution Output)**: Call `install_skill` and ingest only the structured execution report (`filesCopied`, `astInjectionsApplied`, `followUpGuidance`).
   - _Token Cost_: ~300 tokens.

```
Total Context Overhead: < 1,500 tokens (vs. 25,000+ tokens for raw codebase scraping)
```

### 3.2 Selective File Reading

- When inspecting existing project files prior to injection, agents must read only top-level exports and component signatures rather than multi-thousand-line implementation bodies.
- AST transformers handle internal syntax graph traversal in-memory, relieving the LLM of having to read and rewrite entire files.

### 3.3 Redaction of Sensitive Environment Keys

- Values marked with `"secret": true` in `manifest.env` are masked in execution outputs (`***`).
- Agents must never echo secret values in conversational responses.
