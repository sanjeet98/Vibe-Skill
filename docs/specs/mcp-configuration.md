# Model Context Protocol (MCP) Server Configuration Guide

**Document ID:** SPEC-004  
**Status:** Approved  
**Version:** 1.0.0  
**Package:** `@vibe-skill/mcp-server`

---

## 1. Overview

The **Vibe Skill MCP Server** allows AI coding assistants (such as **Claude Desktop**, **Cursor**, **Claude Code**, and **Windsurf**) to programmatically discover, inspect, and install verified skills into a developer's codebase.

The server operates over standard input/output (`stdio`) using JSON-RPC, exposing three primary tools:

1. `list_available_skills`: Returns available skill blueprints, descriptions, and required environment variables, with optional framework filtering.
2. `inspect_skill`: Provides the complete skill manifest, database schema, and architectural rules markdown.
3. `install_skill`: Safely performs deterministic AST injections, copies schema templates, provisions `.env.local` keys, and records state into the workspace lockfile.

### Stdio Protocol Cleanliness

In MCP stdio servers, standard output (`process.stdout`) is strictly reserved for JSON-RPC messages. Diagnostic logs, startup notices, and errors are directed strictly to `process.stderr` (`console.error()`).

---

## 2. Configuration by Agent Platform

### 2.1 Cursor IDE (`.cursor/mcp.json` or Global Settings)

To configure Vibe Skill in Cursor across your team or workspace, create or edit `.cursor/mcp.json` at the root of your project:

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

Or reference installed workspace dependencies:

```json
{
  "mcpServers": {
    "vibe-skill": {
      "command": "node",
      "args": ["./node_modules/@vibe-skill/mcp-server/dist/index.js"]
    }
  }
}
```

---

### 2.2 Claude Desktop (`claude_desktop_config.json`)

To enable Vibe Skill in Claude Desktop, edit your platform configuration file:

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

Add the `vibe-skill` entry to `mcpServers`:

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

_Or via global npx:_

```json
{
  "mcpServers": {
    "vibe-skill": {
      "command": "npx",
      "args": ["-y", "@vibe-skill/mcp-server"],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

---

### 2.3 Claude Code CLI

To configure Vibe Skill for the **Claude Code** terminal agent:

Run the `mcp add` command:

```bash
claude mcp add vibe-skill -- node /absolute/path/to/Vibe-Skill/apps/mcp-server/dist/index.js
```

Or add to your project's `claude.json` or `~/.claude/settings.json`:

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

---

### 2.4 Windsurf IDE (`mcp_config.json`)

To configure Vibe Skill in Windsurf:

- Edit `~/.codeium/windsurf/mcp_config.json`:

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

---

## 3. Environment Variables

The MCP server accepts configuration via environment variables:

| Variable                  | Description                                                     | Default                  |
| :------------------------ | :-------------------------------------------------------------- | :----------------------- |
| `VIBE_SKILLS_PATH`        | Path to skills catalog directory containing `skill.json` files. | `<workspaceRoot>/skills` |
| `ANTIGRAVITY_SKILLS_PATH` | Legacy alias for skills catalog directory.                      | `<workspaceRoot>/skills` |

---

## 4. Available MCP Tools Reference

### `list_available_skills`

Returns a summary catalog of all registered skills.

- **Parameters:**
  - `framework` (`string`, optional): Filter skills by target framework (e.g. `"nextjs"`, `"vite"`).
- **Sample Output:**

```json
{
  "total": 2,
  "skills": [
    {
      "id": "auth-clerk-nextjs",
      "name": "Clerk Authentication for Next.js",
      "version": "1.0.0",
      "description": "Production-grade Clerk authentication for Next.js App Router.",
      "framework": "nextjs",
      "language": "typescript",
      "router": "app-router",
      "requiredEnvVars": [
        "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
        "CLERK_SECRET_KEY"
      ],
      "dependencies": ["@clerk/nextjs"]
    }
  ]
}
```

---

### `inspect_skill`

Fetches the full manifest, AST mutation list, and architectural coding rules for a specific skill.

- **Parameters:**
  - `skillId` (`string`, required): e.g. `"auth-clerk-nextjs"`.
- **Sample Output:**

```json
{
  "found": true,
  "skillId": "auth-clerk-nextjs",
  "manifest": { "...": "..." },
  "rulesMarkdown": "# Clerk Authentication Architectural Rules\n\n1. Always wrap the root layout..."
}
```

---

### `install_skill`

Executes safe AST code injections and copies schema files into a target project.

- **Parameters:**
  - `projectPath` (`string`, required): Target project root directory (e.g. `"/Users/developer/my-next-app"`).
  - `skillId` (`string`, required): Identifier of skill to install (e.g. `"auth-clerk-nextjs"`).
  - `dryRun` (`boolean`, optional, default: `false`): If `true`, simulates modifications without writing changes to disk.
  - `options` (`object`, optional):
    - `skipDependencies` (`boolean`): Skip package installation instructions.
- **Sample Output:**

```json
{
  "success": true,
  "skillId": "auth-clerk-nextjs",
  "projectPath": "/Users/developer/my-next-app",
  "filesCopied": [],
  "astInjectionsApplied": ["src/app/layout.tsx", "src/middleware.ts"],
  "envVarsRequired": ["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY"],
  "dependencies": {
    "@clerk/nextjs": "^5.0.0"
  },
  "followUpGuidance": "Skill \"Clerk Authentication for Next.js\" was successfully installed into /Users/developer/my-next-app.\nDependencies: Run 'pnpm add @clerk/nextjs@^5.0.0'...\nEnvironment: Populate required keys in .env.local...",
  "errors": [],
  "dryRun": false
}
```

---

## 5. Verification & Testing

### Direct Execution via Node

```bash
node apps/mcp-server/dist/index.js
```

_(Listening on stdio; logs startup message to `stderr`)_

### Official MCP Inspector

```bash
npx @modelcontextprotocol/inspector node apps/mcp-server/dist/index.js
```
