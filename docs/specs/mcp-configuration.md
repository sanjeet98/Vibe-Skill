# Model Context Protocol (MCP) Server Configuration Guide

**Document ID:** SPEC-004  
**Status:** Approved  
**Version:** 1.0.0  
**Package:** `@antigravity/mcp-server`

---

## 1. Overview

The **Antigravity MCP Server** allows AI coding assistants (such as **Claude Desktop**, **Cursor**, **Claude Code**, and **Windsurf**) to programmatically discover, inspect, and install verified skills into a developer's codebase.

The server operates over standard input/output (`stdio`) using JSON-RPC, exposing three primary tools:

1. `list_available_skills`: Returns available skill blueprints and required environment variables.
2. `inspect_skill`: Provides the complete skill manifest, database schema, and architectural rules markdown.
3. `install_skill`: Safely performs deterministic AST injections, copies schema templates, and provisions `.env.local` keys.

---

## 2. Configuration by Agent Platform

### 2.1 Claude Desktop (`claude_desktop_config.json`)

To enable Antigravity in Claude Desktop, edit your platform configuration file:

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

Add the `antigravity` entry to `mcpServers`:

```json
{
  "mcpServers": {
    "antigravity": {
      "command": "node",
      "args": ["/path/to/Vibe-Skill/apps/mcp-server/dist/index.js"],
      "env": {
        "ANTIGRAVITY_SKILLS_PATH": "/path/to/Vibe-Skill/skills"
      }
    }
  }
}
```

_Or via global npx / published package:_

```json
{
  "mcpServers": {
    "antigravity": {
      "command": "npx",
      "args": ["-y", "@antigravity/mcp-server"],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

---

### 2.2 Cursor IDE (`.cursor/mcp.json`)

To enable Antigravity in Cursor across your team or workspace, create or edit `.cursor/mcp.json` at the root of your project:

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

_Or via local monorepo path:_

```json
{
  "mcpServers": {
    "antigravity": {
      "command": "node",
      "args": ["/absolute/path/to/Vibe-Skill/apps/mcp-server/dist/index.js"]
    }
  }
}
```

---

### 2.3 Claude Code CLI

To configure Antigravity for the **Claude Code** terminal agent:

Run the `mcp add` command:

```bash
claude mcp add antigravity -- node /absolute/path/to/Vibe-Skill/apps/mcp-server/dist/index.js
```

Or add to your project's `claude.json` / `~/.claude/settings.json`:

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

---

## 3. Available MCP Tools Reference

### `list_available_skills`

Returns a summary catalog of all registered skills.

- **Parameters:** None
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
  "manifest": { ... },
  "rulesMarkdown": "# Clerk Authentication Architectural Rules\n\n1. Always wrap the root layout..."
}
```

---

### `install_skill`

Executes safe AST code injections and copies schema files into a target project.

- **Parameters:**
  - `projectPath` (`string`, required): Target project root directory (e.g. `"/Users/developer/my-next-app"`).
  - `skillId` (`string`, required): Identifier of skill to install (e.g. `"auth-clerk-nextjs"`).
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
  "followUpGuidance": "Skill \"Clerk Authentication for Next.js\" was successfully installed into /Users/developer/my-next-app.\nDependencies: Run 'pnpm add @clerk/nextjs@^5.0.0'...\nEnvironment: Populate required keys in .env.local..."
}
```

---

## 4. Verification

Test the MCP server directly using stdio in your terminal:

```bash
node apps/mcp-server/dist/index.js
```

Or verify using the official MCP Inspector:

```bash
npx @modelcontextprotocol/inspector node apps/mcp-server/dist/index.js
```
