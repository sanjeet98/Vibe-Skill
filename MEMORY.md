# Antigravity: State Persistence & Memory Architecture

> Specifications for project state persistence, workspace lockfiles, and the rollback checkpoint ledger across CLI executions and MCP agent sessions.

---

## 1. State Persistence Architecture

AI coding sessions and developer CLI commands are inherently stateless across executions. Without persistent memory, an AI agent re-entering a project has no reliable way to determine:

- Which skills, authenticators, or databases have already been configured.
- Which specific files were scaffolded or mutated by prior skill runs.
- What version of a skill was installed and whether migrations were applied.

Antigravity establishes a persistent, file-based memory layer directly inside the target repository:

```text
<project-root>/
└── .antigravity/                   # (or .vibe-skill/)
    ├── installed.json              # Canonical workspace skills lockfile
    └── checkpoints/                # Atomic snapshot diffs for rollback
        ├── 2026-10-28T01-15-auth/
        │   ├── manifest.json
        │   └── backups/
        │       └── src/app/layout.tsx
        └── 2026-10-28T02-00-db/
            ├── manifest.json
            └── backups/
                └── src/db/schema/index.ts
```

---

## 2. Workspace Lockfile (`installed.json`)

The workspace lockfile acts as the single source of truth for all skills active within a project. It is stored at `.antigravity/installed.json` (with automatic fallback and compatibility resolution for `.vibe-skill/installed.json`).

### 2.1 JSON Schema Specification

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "AntigravityInstalledLockfile",
  "type": "object",
  "required": ["schemaVersion", "installedSkills"],
  "properties": {
    "schemaVersion": {
      "type": "string",
      "description": "Lockfile schema specification version (SemVer)."
    },
    "installedSkills": {
      "type": "object",
      "description": "Map of installed skill IDs to installation metadata.",
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
          "injectionsCount": { "type": "number" },
          "mutatedFiles": {
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

### 2.2 Concrete Example

```json
{
  "schemaVersion": "1.0.0",
  "installedSkills": {
    "auth-supabase-rbac": {
      "id": "auth-supabase-rbac",
      "name": "Supabase Auth with RBAC",
      "version": "1.0.0",
      "installedAt": "2026-10-28T02:08:14.512Z",
      "source": "skills/auth-supabase-rbac",
      "injectionsCount": 2,
      "mutatedFiles": ["src/app/layout.tsx", "src/middleware.ts"],
      "appliedMigrations": ["supabase/migrations/roles.sql"]
    }
  }
}
```

### 2.3 Querying Installed State

- **Via CLI**:
  ```bash
  antigravity list
  # or: vibe-skill list
  ```
  Returns formatted terminal output showing all registered skills, versions, installation timestamps, and injection counts.
- **Via MCP**:
  AI agents can inspect installed state by reading `.antigravity/installed.json` or invoking `inspect_skill`, preventing redundant installations.

---

## 3. Rollback Checkpoint Ledger

Before any AST mutation is written to disk, the engine creates an immutable checkpoint entry in `.antigravity/checkpoints/`.

### 3.1 Checkpoint Directory Structure

Each checkpoint is namespaced by timestamp and skill ID:

```text
.antigravity/checkpoints/<timestamp>-<skill-id>/
├── checkpoint.json
└── backups/
    └── <relative-path-to-target-file>
```

#### `checkpoint.json` Metadata:

```json
{
  "checkpointId": "2026-10-28T02-08-14-auth-supabase-rbac",
  "skillId": "auth-supabase-rbac",
  "timestamp": "2026-10-28T02:08:14.512Z",
  "gitHead": "ba26894d0c9f1a23847e92384729384729384729",
  "mutatedFiles": ["src/app/layout.tsx", "src/middleware.ts"],
  "createdFiles": [
    "src/components/auth-provider.tsx",
    "src/lib/supabase/client.ts",
    "src/lib/supabase/server.ts",
    "supabase/migrations/roles.sql"
  ]
}
```

### 3.2 Rollback Execution Workflow

When an error occurs during installation, or when a developer runs `antigravity rollback <checkpointId>`:

1. **File Restoration**: The engine reads the `backups/` directory and restores all mutated files back to their exact pre-installation byte sequence.
2. **Created File Cleanup**: The engine deletes all files recorded in `createdFiles`.
3. **Lockfile Synchronization**: The skill entry is removed from `installed.json`.
4. **Environment Pruning**: Newly added `.env` keys associated with the skill's comment block (`# --- Antigravity: <name> ---`) are safely commented out or removed.
5. **Prettier Audit**: Restored files are re-checked to ensure formatting consistency.

This ledger guarantees that code modifications are **reversible**, eliminating the risk of partial, corrupted code states.
