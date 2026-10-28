# Vibe Skill: Execution Flows & Lifecycle State Machine

This document details the operational execution flows of the Vibe Skill system: the 9-stage **End-to-End Skill Installation Lifecycle** and the **Model Context Protocol (MCP) Agent Interaction Flow**.

---

## 1. End-to-End Skill Installation Lifecycle

Every skill installation—whether triggered via the developer CLI (`vibe-skill add`) or by an AI agent over MCP (`install_skill`)—progresses through an atomic, 9-stage state machine.

### Lifecycle State Machine Diagram

```text
  ┌─────────────────────────────────────────────────────────────┐
  │ 1. DISCOVERY & RESOLUTION                                   │
  │    • Resolve local skill path or remote registry tarball     │
  └──────────────────────────────┬──────────────────────────────┘
                                 │
                                 ▼
  ┌─────────────────────────────────────────────────────────────┐
  │ 2. MANIFEST & COMPATIBILITY VALIDATION                      │
  │    • Zod parse skill.json                                   │
  │    • Match framework, router, & language matrix             │
  └──────────────────────────────┬──────────────────────────────┘
                                 │
                                 ▼
  ┌─────────────────────────────────────────────────────────────┐
  │ 3. PRE-FLIGHT CHECKPOINT                                    │
  │    • Create in-memory file snapshots                        │
  │    • Verify target file accessibility                       │
  └──────────────────────────────┬──────────────────────────────┘
                                 │
                                 ▼
  ┌─────────────────────────────────────────────────────────────┐
  │ 4. DETERMINISTIC AST INJECTIONS                             │
  │    • Inject imports (import-injector.ts)                     │
  │    • Wrap layout JSX (jsx-wrapper-injector.ts)              │
  │    • Barrel re-exports (export-reexport-injector.ts)        │
  │    • Format modified AST via Prettier                       │
  └──────────────────────────────┬──────────────────────────────┘
                                 │
                                 ▼
  ┌─────────────────────────────────────────────────────────────┐
  │ 5. SCHEMA & TEMPLATE PLACEMENT                              │
  │    • Copy component & lib source files                      │
  │    • Copy SQL migrations / ORM schema definitions           │
  └──────────────────────────────┬──────────────────────────────┘
                                 │
                                 ▼
  ┌─────────────────────────────────────────────────────────────┐
  │ 6. ENVIRONMENT VARIABLE PROVISIONING                        │
  │    • Read existing .env / .env.local                        │
  │    • Append missing keys with documentation comments        │
  └──────────────────────────────┬──────────────────────────────┘
                                 │
                                 ▼
  ┌─────────────────────────────────────────────────────────────┐
  │ 7. PACKAGE DEPENDENCY INSTALLATION                          │
  │    • Detect project package manager (pnpm/npm/yarn/bun)     │
  │    • Execute dependency installation                        │
  └──────────────────────────────┬──────────────────────────────┘
                                 │
                                 ▼
  ┌─────────────────────────────────────────────────────────────┐
  │ 8. VERIFICATION & DIAGNOSTIC AUDIT                          │
  │    • TypeScript syntax diagnostics check                    │
  │    • Optional tsc --noEmit dry run                          │
  └──────────────────────────────┬──────────────────────────────┘
                                 │
             ┌───────────────────┴───────────────────┐
      Pass   │                                       │ Fail
             ▼                                       ▼
  ┌─────────────────────────────┐         ┌─────────────────────────────┐
  │ 9a. COMMIT & LOCKFILE       │         │ 9b. ATOMIC ROLLBACK         │
  │ • Write .vibe-skill/        │         │ • Restore files from        │
  │   installed.json            │         │   in-memory snapshots       │
  │ • Output follow-up guidance │         │ • Clean up copied files     │
  │ • Status: SUCCESS           │         │ • Status: ABORTED           │
  └─────────────────────────────┘         └─────────────────────────────┘
```

---

### Step-by-Step Stage Breakdown

#### Stage 1: Skill Discovery & Resolution

- **Input**: Skill identifier (e.g. `auth-supabase-rbac`) or local directory path.
- **Actions**:
  - Checks if the input points to a local directory containing `skill.json`.
  - If not local, queries the configured skills catalog / remote registry cache (`packages/infra-core`).
  - Resolves absolute path to the skill directory and its assets.
- **Error Condition**: Halts if no valid skill package can be located.

#### Stage 2: Manifest & Compatibility Validation

- **Input**: Raw `skill.json` content and detected target `ProjectInfo`.
- **Actions**:
  - Validates `skill.json` using `validateManifest()` from `@vibe-skill/manifest`.
  - Validates SemVer schema version, kebab-case IDs, and injection discriminators.
  - Matches skill `compatibility` against the target project:
    - Framework (`nextjs` vs `vite` vs `remix` vs `fastapi`).
    - Language (`typescript` vs `python`).
    - Router (`app-router` vs `pages` vs `null`).
- **Error Condition**: Halts if manifest schema fails validation or if the target project environment is incompatible (unless overridden with `--force`).

#### Stage 3: Pre-Flight Checkpoint

- **Input**: List of injection target files and template destinations.
- **Actions**:
  - Verifies that target files declared in `injections` (e.g. `src/app/layout.tsx`) exist in the project.
  - Captures an in-memory snapshot (`Map<string, string>`) of all target files before modifications begin.
- **Error Condition**: Halts if target injection files are missing.

#### Stage 4: Deterministic AST Injections

- **Input**: In-memory snapshots and `manifest.injections` definitions.
- **Actions**:
  - Initializes a `ts-morph` `Project` instance.
  - Sequentially applies injection transformers:
    - `import-injector.ts`: Adds required module imports idempotently without duplicating symbols.
    - `jsx-wrapper-injector.ts`: Wraps root component children with the skill's context provider.
    - `export-reexport-injector.ts`: Re-exports database schemas in central barrel indexes.
  - Formats all mutated files with Prettier before writing.
- **Error Condition**: Any syntax error detected by the compiler triggers **Stage 9b: Atomic Rollback**.

#### Stage 5: Schema & Template Placement

- **Input**: Template directory `template/` and `manifest.database.schemaFiles`.
- **Actions**:
  - Copies template components, utilities, and middleware into target directories (e.g., `src/components/`, `src/lib/supabase/`).
  - Copies database schemas and migration files (e.g., `supabase/migrations/roles.sql`).
  - Automatically respects project structure (supporting both `src/`-based and flat project layouts).

#### Stage 6: Environment Variable Provisioning

- **Input**: `manifest.env` array of required and optional environment keys.
- **Actions**:
  - Reads existing `.env.local` or `.env`.
  - Scans for existing keys using regex matching (`^KEY=`).
  - Appends missing keys formatted with descriptive headers:
    ```bash
    # --- Vibe Skill: Supabase Auth with RBAC ---
    # Public URL for Supabase API gateway
    NEXT_PUBLIC_SUPABASE_URL=
    ```
  - Also updates `.env.example` if present in the target repository.

#### Stage 7: Package Dependency Installation

- **Input**: `manifest.dependencies.npm`.
- **Actions**:
  - Identifies project package manager from lockfiles (`pnpm-lock.yaml`, `package-lock.json`, `yarn.lock`, `bun.lockb`).
  - Runs the installation command (e.g., `pnpm add @supabase/supabase-js@^2.45.0 @supabase/ssr@^0.5.0`).
  - Skipped if `--no-install` or `skipDependencies: true` is passed (standard in agent environments).

#### Stage 8: Verification & Diagnostic Audit

- **Input**: Mutated files on disk.
- **Actions**:
  - Re-parses mutated files to verify zero syntactic anomalies.
  - Asserts that all injected provider tags and re-exports resolve cleanly.

#### Stage 9: Completion

- **Success (9a)**:
  - Writes/updates `.vibe-skill/installed.json` lockfile recording installed version, timestamp, and source.
  - Returns structured guidance to developer or agent (e.g. required `.env` values to populate, migration scripts to run).
- **Failure (9b)**:
  - Invokes rollback mechanism; restores all original file snapshots.
  - Removes any partially copied template files.
  - Returns detailed error diagnostics.

---

## 2. Model Context Protocol (MCP) Agent Interaction Flow

AI coding assistants (Claude Desktop, Cursor, Claude Code, Windsurf) communicate with the Vibe Skill platform via standard input/output (`stdio`) using JSON-RPC 2.0.

### Protocol Sequence Diagram

```text
┌──────────────┐                               ┌──────────────────────┐
│   AI Agent   │                               │  apps/mcp-server     │
│ (Cursor/IDE) │                               │ (vibe-skill-mcp)     │
└──────┬───────┘                               └──────────┬───────────┘
       │                                                  │
       │  1. initialize (Capabilities negotiation)        │
       ├─────────────────────────────────────────────────►│
       │  2. result (Server info & supported protocols)   │
       │◄─────────────────────────────────────────────────┤
       │                                                  │
       │  3. notifications/initialized                    │
       ├─────────────────────────────────────────────────►│
       │                                                  │
       │  4. tools/list Request                           │
       ├─────────────────────────────────────────────────►│
       │  5. tools/list Response:                         │
       │     • list_available_skills                      │
       │     • inspect_skill                              │
       │     • install_skill                              │
       │◄─────────────────────────────────────────────────┤
       │                                                  │
       │ ── Agent Workflow: Discovery ─────────────────── │
       │                                                  │
       │  6. tools/call: list_available_skills            │
       ├─────────────────────────────────────────────────►│
       │  7. Returns catalog summaries & env requirements │
       │◄─────────────────────────────────────────────────┤
       │                                                  │
       │ ── Agent Workflow: Inspection & Architecture ─── │
       │                                                  │
       │  8. tools/call: inspect_skill                    │
       │     { skillId: "auth-supabase-rbac" }            │
       ├─────────────────────────────────────────────────►│
       │  9. Returns skill.json + agent/rules.md          │
       │     (Agent now understands architecture rules)   │
       │◄─────────────────────────────────────────────────┤
       │                                                  │
       │ ── Agent Workflow: Installation ──────────────── │
       │                                                  │
       │ 10. tools/call: install_skill                    │
       │     { projectPath: "/repo",                      │
       │       skillId: "auth-supabase-rbac",             │
       │       options: { skipDependencies: true } }      │
       ├─────────────────────────────────────────────────►│
       │     [Executes 9-stage AST & File Pipeline]       │
       │ 11. Returns InstallSkillResponse:                │
       │     • filesCopied: [...]                         │
       │     • astInjectionsApplied: [...]                │
       │     • envVarsRequired: [...]                     │
       │     • followUpGuidance: "..."                    │
       │◄─────────────────────────────────────────────────┤
       │                                                  │
       │ ── Agent Follow-Up Execution ─────────────────── │
       │                                                  │
       │ 12. Agent follows architectural rules to write   │
       │     feature code (protected routes, actions)     │
       └──────────────────────────────────────────────────┘
```

### Key MCP Tools Exposed

1. **`list_available_skills`**:
   - Queries workspace and global skills roots.
   - Provides summary catalog: framework, language, required environment variables, and external package dependencies.

2. **`inspect_skill(skillId)`**:
   - Returns the complete declarative `skill.json` manifest.
   - Loads and streams `agent/rules.md`, embedding domain-specific architectural constraints directly into the agent's reasoning loop.

3. **`install_skill(projectPath, skillId, options)`**:
   - Runs the deterministic AST transformation pipeline directly against the agent's target codebase.
   - Returns a structured execution report containing modified files, copied assets, and concrete follow-up tasks.
