# Antigravity: Multi-Agent Governance & Operational Protocols

> Operational rules, agent taxonomy, tool invocation constraints, and context economics for autonomous AI coding agents interacting with the Antigravity (Vibe Skill) platform.

---

## 1. Agent Taxonomy & Roles

Antigravity employs a role-segregated multi-agent architecture. By separating high-level intent from AST code manipulation, environment provisioning, and quality verification, the platform prevents hallucinated modifications and non-deterministic regressions.

```text
                           ┌───────────────────────────────┐
                           │      Orchestrator Agent       │
                           │  (Intent, Planning, Registry) │
                           └───────────────┬───────────────┘
                                           │
                   ┌───────────────────────┼───────────────────────┐
                   │                       │                       │
                   ▼                       ▼                       ▼
     ┌───────────────────────────┐ ┌──────────────┐ ┌───────────────────────────┐
     │    AST Injection Agent    │ │ Provisioner  │ │   Verification & Quality  │
     │ (ts-morph Codemod Engine) │ │ (Env, DB)    │ │ (tsc, Vitest, Diagnostics)│
     └───────────────────────────┘ └──────────────┘ └───────────────────────────┘
```

### 1.1 Orchestrator Agent

- **Primary Objective**: Interprets developer intent, evaluates project configuration, and discovers compatible skill blueprints.
- **Responsibilities**:
  - Ingests natural language prompts (e.g., _"Set up Supabase authentication with role-based permissions in my Next.js app"_).
  - Queries the registry using `list_available_skills` and selects matching blueprints.
  - Checks target project compatibility (framework, language, router) before dispatching work.
  - Reads domain rules via `inspect_skill` and constructs the implementation plan.
- **Permissions & Boundaries**:
  - **Allowed**: Invoking read-only discovery tools (`list_available_skills`, `inspect_skill`), reading project manifests (`package.json`, `tsconfig.json`).
  - **Forbidden**: Directly modifying source files, editing environment variables, or executing package installations.

### 1.2 AST Injection Agent

- **Primary Objective**: Safely applies structural, non-destructive code mutations directly to Abstract Syntax Trees.
- **Responsibilities**:
  - Executes deterministic AST transformations (`jsx_wrapper`, `named_export`, `re_export`, `middleware_chain`).
  - Injects providers into root components (e.g., wrapping `<AuthProvider>` around layout children).
  - Injects imports cleanly, merging named specifiers into existing clauses without duplication.
  - Preserves leading comments, license headers, and directives (`'use client'`, `'use server'`).
  - Enforces Prettier code formatting after AST mutation.
- **Permissions & Boundaries**:
  - **Allowed**: Invoking `@antigravity/ast-engine` or MCP `install_skill`.
  - **Forbidden**: Performing raw text search-and-replace on files that have registered AST transformers; dropping unhandled syntax errors.

### 1.3 Infrastructure Provisioner Agent

- **Primary Objective**: Manages environment variables, schema migrations, and external service contracts.
- **Responsibilities**:
  - Inspects existing `.env` and `.env.local` files to detect pre-existing keys.
  - Appends missing environment variable templates with descriptive inline documentation.
  - Copies required schema migrations (e.g. `supabase/migrations/roles.sql`, Drizzle schema files).
  - Automatically masks variables flagged as `"secret": true` from agent logs and reasoning traces.
- **Permissions & Boundaries**:
  - **Allowed**: Modifying `.env*` files, placing template migration files, running schema push/migration commands.
  - **Forbidden**: Exposing raw secrets in tool outputs; deleting or overwriting pre-existing user environment keys.

### 1.4 Verification & Quality Agent

- **Primary Objective**: Validates syntactic, architectural, and runtime integrity before finalizing changes.
- **Responsibilities**:
  - Runs TypeScript syntax audits (`tsc --noEmit`) to verify zero compiler regressions.
  - Executes unit test fixtures and end-to-end smoke tests.
  - If verification passes, writes the audit record to `.antigravity/installed.json` (or `.vibe-skill/installed.json`).
  - If verification fails, immediately triggers an **Atomic Rollback** from in-memory snapshots.
- **Permissions & Boundaries**:
  - **Allowed**: Executing test runners, lint tools, and rollback commands.
  - **Forbidden**: Bypassing type-check errors without explicit human override.

---

## 2. Tool Invocation Constraints

To ensure safety and idempotency, AI agents must adhere to strict policies regarding tool usage versus direct file editing:

| Action Scenario                       | Permitted Mechanism                                  | Prohibited Mechanism                                | Rationale                                                                                                                       |
| :------------------------------------ | :--------------------------------------------------- | :-------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------ |
| **Installing a Skill Blueprint**      | MCP `install_skill` or CLI `antigravity add <skill>` | Direct manual file editing or string regex patching | Skills declare atomic AST transformations and migrations that must be executed in a transactional checkpoint.                   |
| **Injecting Providers / Wrappers**    | `@antigravity/ast-engine` (`jsx_wrapper`)            | String concatenation on `layout.tsx`                | Raw string patching frequently breaks closing JSX tags and strips `'use client'`.                                               |
| **Updating Barrel Exports**           | `@antigravity/ast-engine` (`re_export`)              | Appending `export *` via text tools                 | AST transformers check for prior exports and preserve alphabetical formatting.                                                  |
| **Writing Novel Business Logic**      | Direct file creation (`write_file`, `edit_file`)     | N/A (Direct edit required)                          | Writing application-specific components, custom endpoints, or pages not covered by skills is the natural role of generative AI. |
| **Configuring Environment Variables** | Automated installer appending                        | Overwriting whole `.env` files                      | Preserves existing keys, database URLs, and API tokens while cleanly appending new requirements.                                |

### Golden Rule of File Modification

> **If an AST transformer or skill blueprint exists for a task, the agent MUST use the tool. Agents must NEVER use text search-and-replace for structural scaffolding.**

---

## 3. Context Economics & Token Budgeting

Large context windows degrade reasoning efficiency and increase latency. Antigravity establishes strict context budgeting protocols:

### 3.1 Progressive Discovery

Agents must never load entire skill registries or full source trees into context upfront:

1. **Index Phase**: Call `list_available_skills`. This returns a minimal payload containing only `id`, `name`, `framework`, and `requiredEnvVars` (~100 tokens per skill).
2. **Evaluation Phase**: The Orchestrator selects candidate IDs based on user intent.
3. **Inspection Phase**: Call `inspect_skill(skillId)` _only_ for the selected candidate. This loads the targeted `skill.json` and `rules.md` without loading unused skills.

### 3.2 Structured Execution Reports

The `install_skill` tool returns a compact summary:

```json
{
  "success": true,
  "skillId": "auth-supabase-rbac",
  "filesCopied": [
    "src/components/auth-provider.tsx",
    "supabase/migrations/roles.sql"
  ],
  "astInjectionsApplied": ["src/app/layout.tsx", "src/middleware.ts"],
  "envVarsRequired": [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  ],
  "followUpGuidance": "..."
}
```

- **Protocol**: The agent must consume this structured report directly. It must **not** re-read each modified file from disk unless specifically directed to edit application-level code inside it.

### 3.3 Context Eviction Policy

Once a skill is successfully installed:

- Summarize the installation in 2–3 sentences.
- Reference the updated `.env.local` requirements.
- Evict intermediate manifest JSON objects and AST transformation traces from subsequent prompt turns to preserve working memory for code generation.

---

## 4. Continuous File Currency & Synchronization Mandate

All autonomous AI coding agents interacting with the Antigravity codebase must adhere to the **Continuous Currency Mandate**:

### 4.1 The Rule

> **Whenever an agent creates, modifies, or deletes code, configuration, or documentation in this repository, it MUST identify and update all dependent files in the same turn before concluding.**

Leaving documentation, tests, specs, lockfiles, or changelog entries out of sync with code modifications is strictly prohibited.

### 4.2 Agent Turn Audit Sequence

Before presenting completion to the user:

1. **Audit Modified Files**: Inspect the set of mutated files.
2. **Synchronize Dependencies**:
   - If manifest schemas or types were changed: update `docs/specs/skill-schema-spec.md`, `docs/specs/001-manifest-schema.md`, `packages/manifest/tests/`, and `ARCHITECTURE.md`.
   - If AST transformers or injectors were changed: update `packages/ast-engine/tests/`, `DESIGN.md`, `FLOW.md`, and `ARCHITECTURE.md`.
   - If CLI or MCP commands/tools were changed: update `README.md`, `ARCHITECTURE.md`, `FLOW.md`, `docs/specs/mcp-configuration.md`, and fixture tests.
   - If skills were added or modified: update `skills/<id>/skill.json`, `skills/<id>/agent/rules.md`, and `README.md`.
   - If state persistence or lockfiles were changed: update `MEMORY.md`.
   - If security or audit rules were changed: update `SECURITY.md`, `AUDIT.md`, and `.github/workflows/ci.yml`.
   - If new features, fixes, or deliverables were added: update `CHANGELOG.md` under `[Unreleased]`.
3. **Run Verification**: Ensure `pnpm format:check`, `pnpm lint`, and `pnpm test` (all 49+ tests) pass cleanly.
