# Antigravity: State Persistence & Memory Architecture

This document defines the persistence model of the **Antigravity (Vibe Skill)** platform, detailing how workspace state, skill registrations, checkpoint ledgers, and atomic rollback transactions are maintained across CLI commands and AI agent MCP sessions.

---

## 1. State Persistence Architecture

Because AI coding agents and CLI commands run in isolated, stateless process invocations, Antigravity decouples state into two complementary tiers:

```text
┌────────────────────────────────────────────────────────┐
│                   Ephemeral Memory                     │
│  (In-Memory Process Scope: Single CLI/MCP Execution)   │
├────────────────────────────────────────────────────────┤
│ • ts-morph in-memory Project AST cache                 │
│ • Transaction rollback snapshot Map<string, string>    │
│ • Dynamic framework & language detection state        │
└───────────────────────────┬────────────────────────────┘
                            │
                            │ Persisted upon verification
                            ▼
┌────────────────────────────────────────────────────────┐
│                  Persistent Memory                     │
│       (On-Disk Repository Scope: Project Root)         │
├────────────────────────────────────────────────────────┤
│ • .vibe-skill/installed.json (Skill Lockfile)          │
│ • .vibe-skill/checkpoints/ (Diff & Snapshot Ledger)    │
│ • .env.local / .env (Provisioned Variables)            │
│ • Git History (Conventional Commits)                   │
└────────────────────────────────────────────────────────┘
```

---

## 2. Workspace Lockfile (`installed.json`)

The workspace lockfile serves as the authoritative source of truth for all skills installed in a target project. It is stored at `.vibe-skill/installed.json` (with backward compatibility for `.antigravity/installed.json`).

### 2.1 JSON Schema Specification

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "InstalledSkillsLockfile",
  "type": "object",
  "required": ["schemaVersion", "installedSkills"],
  "properties": {
    "schemaVersion": {
      "type": "string",
      "description": "Semantic version of the lockfile schema (e.g. '1.0.0')"
    },
    "installedSkills": {
      "type": "object",
      "additionalProperties": {
        "type": "object",
        "required": [
          "id",
          "name",
          "version",
          "installedAt",
          "source",
          "injectionsCount"
        ],
        "properties": {
          "id": { "type": "string" },
          "name": { "type": "string" },
          "version": { "type": "string" },
          "installedAt": { "type": "string", "format": "date-time" },
          "source": { "type": "string" },
          "injectionsCount": { "type": "integer" },
          "injectedFiles": {
            "type": "array",
            "items": { "type": "string" }
          },
          "appliedMigrations": {
            "type": "array",
            "items": { "type": "string" }
          }
        }
      }
    }
  }
}
```

### 2.2 Canonical Lockfile Example

```json
{
  "schemaVersion": "1.0.0",
  "installedSkills": {
    "auth-supabase-rbac": {
      "id": "auth-supabase-rbac",
      "name": "Supabase Auth with RBAC",
      "version": "1.0.0",
      "installedAt": "2026-10-28T02:07:31.428Z",
      "source": "skills/auth-supabase-rbac",
      "injectionsCount": 2,
      "injectedFiles": ["src/app/layout.tsx", "src/middleware.ts"],
      "appliedMigrations": ["supabase/migrations/roles.sql"]
    },
    "db-drizzle-pg": {
      "id": "db-drizzle-pg",
      "name": "Drizzle ORM for PostgreSQL",
      "version": "1.0.0",
      "installedAt": "2026-10-28T02:08:14.912Z",
      "source": "skills/db-drizzle-pg",
      "injectionsCount": 1,
      "injectedFiles": ["src/db/schema/index.ts"],
      "appliedMigrations": []
    }
  }
}
```

### 2.3 Consumption by CLI & MCP

- **`vibe-skill list`**: Reads `installedSkills` and renders an interactive summary table showing skill names, versions, installation timestamps, and injection counts.
- **`vibe-skill add` & `install_skill`**: Checks if the target skill ID already exists in `installedSkills`. If present and the version matches, warns the user that the skill is already configured, preventing duplicate processing.

---

## 3. Rollback Checkpoint Ledger

To provide guaranteed reversibility and protect production codebases against breaking transformations, Antigravity maintains an automated **Checkpoint Ledger** under `.vibe-skill/checkpoints/` (or `.antigravity/checkpoints/`).

### 3.1 Checkpoint Directory Structure

```text
.vibe-skill/checkpoints/
├── index.json                               # Master ledger indexing all checkpoints
├── chk_20261028_170001_auth_supabase/       # Individual checkpoint bundle
│   ├── meta.json                            # Checkpoint metadata & trigger context
│   ├── patch.diff                           # Unified Git diff of all modified files
│   └── snapshots/                           # Pristine copies of affected files before mutation
│       ├── src/app/layout.tsx
│       └── .env.local
```

### 3.2 Checkpoint Metadata (`meta.json`)

```json
{
  "checkpointId": "chk_20261028_170001_auth_supabase",
  "timestamp": "2026-10-28T17:00:01.120Z",
  "skillId": "auth-supabase-rbac",
  "skillVersion": "1.0.0",
  "trigger": "cli:add",
  "gitCommitSha": "ba26894a8f9...",
  "filesModified": ["src/app/layout.tsx", ".env.local"],
  "filesCreated": [
    "src/components/auth-provider.tsx",
    "src/lib/supabase/client.ts",
    "src/lib/supabase/server.ts",
    "supabase/migrations/roles.sql"
  ]
}
```

### 3.3 Reversal & Rollback Procedure

When an installation fails or when a developer/agent invokes `vibe-skill rollback <checkpoint-id>`:

1. **Pristine Snapshot Restoration**: The engine reads `snapshots/` and overwrites all `filesModified` with their pre-mutation states.
2. **Created File Pruning**: All files listed in `filesCreated` are deleted from the workspace.
3. **Lockfile Synchronization**: The skill entry is purged from `.vibe-skill/installed.json`.
4. **Prettier Pass**: Restored files are reformatted to match repository code standards.
5. **Ledger Update**: The checkpoint is marked as `"status": "reverted"` in `index.json`.

This multi-tiered persistence architecture guarantees that developer codebases remain resilient, auditable, and easily reversible at all times.
