# Antigravity Specification: Skill Definition Schema (`skill.json`)

**Document ID:** SPEC-002  
**Status:** Implemented  
**Version:** 1.0.0  
**Package:** `@antigravity/manifest`

---

## 1. Overview

An **Antigravity Skill** is a modular, declarative capability unit designed to bridge AI coding agents with deterministic code synthesis. Every skill package MUST provide a `skill.json` (or `skill.yaml`) at its root that strictly adheres to the schema defined in this specification.

Unlike unstructured prompts or loose markdown documentation, `skill.json` enables the Antigravity engine to:

1. **Enforce Deterministic Scaffolding:** Perform targeted AST mutations (`jsx_wrapper`, `named_export`, `middleware_chain`) rather than unpredictable search-and-replace text edits.
2. **Resolve Runtime & Framework Compatibility:** Match project configurations against supported languages, frameworks, and routers.
3. **Provision Dependencies & Environment Secrets:** Automatically inject npm/pip packages, peer skill dependencies, and environment variable requirements.
4. **Supply Isolated Agent Context:** Provide specialized prompt rules and automated test suites for self-verifying code generation.

---

## 2. Top-Level Schema Specification

| Property        | Type                  | Required | Description                                                                                                   |
| :-------------- | :-------------------- | :------: | :------------------------------------------------------------------------------------------------------------ |
| `schemaVersion` | `string` (SemVer)     | **Yes**  | Version of the Antigravity manifest schema (e.g. `"1.0.0"`).                                                  |
| `id`            | `string` (kebab-case) | **Yes**  | Unique package identifier consisting of lowercase letters, numbers, and hyphens (e.g. `"auth-clerk-nextjs"`). |
| `name`          | `string`              | **Yes**  | Human-readable title of the skill.                                                                            |
| `version`       | `string` (SemVer)     | **Yes**  | Semantic version of the skill implementation (e.g. `"0.1.0"`).                                                |
| `description`   | `string`              | **Yes**  | Plain text description explaining what the skill configures or accomplishes.                                  |
| `compatibility` | `object`              | **Yes**  | Target framework, language, and routing architecture compatibility.                                           |
| `dependencies`  | `object`              | **Yes**  | External package dependencies and peer skill constraints.                                                     |
| `env`           | `array<object>`       | **Yes**  | Environment variables required by the skill.                                                                  |
| `database`      | `object`              |    No    | Optional database ORM and schema migration declarations.                                                      |
| `injections`    | `array<object>`       | **Yes**  | AST mutation instructions to be performed during skill installation.                                          |
| `agentContext`  | `object`              | **Yes**  | Context rules and test harness paths for agent guidance and verification.                                     |

---

## 3. Sub-Schema Details

### 3.1 `compatibility`

Configures the ecosystem requirements for the target codebase:

```typescript
interface CompatibilityConfig {
  framework: "nextjs" | "vite" | "remix" | "fastapi";
  language: "typescript" | "python";
  router: "app-router" | "pages" | null;
}
```

- `framework`: Supported application framework.
- `language`: Source language target.
- `router`: Routing strategy (for Next.js projects; set to `null` if not applicable).

### 3.2 `dependencies`

Defines packages and peer skills required for installation:

```typescript
interface DependenciesConfig {
  npm: Record<string, string>; // e.g. { "@clerk/nextjs": "^5.0.0" }
  peerSkills?: Record<string, string>; // e.g. { "db-drizzle": "^1.0.0" }
}
```

### 3.3 `env`

Declares environment variables, sensitivity levels, and auto-provisioning hints:

```typescript
interface EnvVariable {
  key: string;
  required: boolean;
  secret: boolean;
  description?: string;
  autoProvision?: boolean;
}
```

- `key`: Uppercase variable name (e.g. `CLERK_SECRET_KEY`).
- `required`: If `true`, installer halts if the key is missing from `.env`.
- `secret`: If `true`, the value is redacted from agent reasoning traces and build logs.
- `autoProvision`: Hint for cloud connectors (e.g., Vercel, Supabase, Infisical) to create the variable automatically.

### 3.4 `database` (Optional)

Declarations for ORM-driven skills:

```typescript
interface DatabaseSchemaFile {
  source: string; // Relative path to template in skill package
  target: string; // Relative path in target project
  exportTarget?: string; // Central schema index to re-export the file
}

interface DatabaseConfig {
  orm: "drizzle" | "prisma";
  schemaFiles: DatabaseSchemaFile[];
  migrationCommand?: string;
}
```

### 3.5 `injections` (Discriminated Union on `type`)

The AST Scaffolding Engine executes code injections based on a discriminated union on `type`:

#### A. `jsx_wrapper`

Wraps the root JSX element in a target file with a component (e.g., Context Providers, Theme Providers):

```json
{
  "type": "jsx_wrapper",
  "targetFile": "src/app/layout.tsx",
  "import": {
    "identifier": "ClerkProvider",
    "module": "@clerk/nextjs"
  },
  "wrapperComponent": "ClerkProvider"
}
```

#### B. `named_export`

Injects an exported symbol or re-export into a module:

```json
{
  "type": "named_export",
  "targetFile": "src/auth.ts",
  "exportName": "auth",
  "module": "@clerk/nextjs/server"
}
```

#### C. `middleware_chain`

Inserts a middleware step into an existing pipeline:

```json
{
  "type": "middleware_chain",
  "targetFile": "src/middleware.ts",
  "import": {
    "identifier": "clerkMiddleware",
    "module": "@clerk/nextjs/server"
  },
  "pipelineStep": "clerkMiddleware()"
}
```

### 3.6 `agentContext`

Provides AI coding agents with behavioral instructions and automated verification tests:

```typescript
interface AgentContextConfig {
  rulesFile: string; // Markdown document with agent guidelines
  testSuite?: string; // Automated test file validating correct integration
}
```

---

## 4. Comprehensive Examples

### Example 1: Full Next.js + Clerk Auth with Drizzle ORM

```json
{
  "schemaVersion": "1.0.0",
  "id": "auth-clerk-nextjs",
  "name": "Clerk Authentication for Next.js",
  "version": "1.2.0",
  "description": "Configures Clerk authentication, middleware protection, and user profile sync via Drizzle ORM.",
  "compatibility": {
    "framework": "nextjs",
    "language": "typescript",
    "router": "app-router"
  },
  "dependencies": {
    "npm": {
      "@clerk/nextjs": "^5.3.0",
      "drizzle-orm": "^0.33.0"
    },
    "peerSkills": {
      "db-drizzle": "^1.0.0"
    }
  },
  "env": [
    {
      "key": "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
      "required": true,
      "secret": false,
      "description": "Publishable API key for Clerk browser SDK",
      "autoProvision": false
    },
    {
      "key": "CLERK_SECRET_KEY",
      "required": true,
      "secret": true,
      "description": "Secret API key for Clerk server-side operations",
      "autoProvision": true
    }
  ],
  "database": {
    "orm": "drizzle",
    "schemaFiles": [
      {
        "source": "templates/schema/auth.ts",
        "target": "src/db/schema/auth.ts",
        "exportTarget": "src/db/schema/index.ts"
      }
    ],
    "migrationCommand": "pnpm drizzle-kit push"
  },
  "injections": [
    {
      "type": "jsx_wrapper",
      "targetFile": "src/app/layout.tsx",
      "import": {
        "identifier": "ClerkProvider",
        "module": "@clerk/nextjs"
      },
      "wrapperComponent": "ClerkProvider"
    },
    {
      "type": "named_export",
      "targetFile": "src/lib/auth.ts",
      "exportName": "auth",
      "module": "@clerk/nextjs/server"
    },
    {
      "type": "middleware_chain",
      "targetFile": "src/middleware.ts",
      "import": {
        "identifier": "clerkMiddleware",
        "module": "@clerk/nextjs/server"
      },
      "pipelineStep": "clerkMiddleware()"
    }
  ],
  "agentContext": {
    "rulesFile": "prompts/auth-guidelines.md",
    "testSuite": "tests/e2e/auth.spec.ts"
  }
}
```

### Example 2: FastAPI CORS Integration

```json
{
  "schemaVersion": "1.0.0",
  "id": "fastapi-cors",
  "name": "FastAPI CORS Middleware",
  "version": "0.5.0",
  "description": "Standardizes cross-origin resource sharing middleware for FastAPI services.",
  "compatibility": {
    "framework": "fastapi",
    "language": "python",
    "router": null
  },
  "dependencies": {
    "npm": {}
  },
  "env": [
    {
      "key": "ALLOWED_ORIGINS",
      "required": false,
      "secret": false,
      "description": "Comma-separated list of allowed origins",
      "autoProvision": false
    }
  ],
  "injections": [],
  "agentContext": {
    "rulesFile": "prompts/fastapi-cors.md"
  }
}
```

---

## 5. Programmatic API Usage

Install and use `@antigravity/manifest` in your tooling or agent loop:

```typescript
import { validateManifest, assertValidManifest } from "@antigravity/manifest";

// Safe validation returning success flag & path-specific errors
const result = validateManifest(rawJson);

if (result.success) {
  console.log(`Validated skill: ${result.data.name} (v${result.data.version})`);
} else {
  console.error("Manifest validation errors:");
  result.errors.forEach((err) => console.error(`  - ${err}`));
}

// Strict assertion throwing an error with all violations
try {
  const manifest = assertValidManifest(rawJson);
} catch (error) {
  // Handles formatting with JSON path violations
}
```
