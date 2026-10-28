# Antigravity: Testing Strategy & Verification Architecture

> Comprehensive testing philosophy, hierarchy, fixture methodologies, and CI/CD execution guidelines for the Antigravity (Vibe Skill) platform.

---

## 1. Testing Philosophy & Hierarchy

Antigravity operates on user codebases. A single defect could break application compilation or corrupt developer files. Therefore, our testing pyramid is designed around multi-tiered verification with heavy emphasis on deterministic AST fixture testing:

```text
               ┌─────────────────────────────┐
               │    Fixture E2E Tests        │  (apps/cli & apps/mcp-server)
               │  Full Next.js integrations  │  5–10 tests, ~1–2s
               └──────────────┬──────────────┘
                              │
               ┌──────────────┴──────────────┐
               │    AST Transform Tests      │  (packages/ast-engine)
               │ Isolated syntactic mutations│  10–20 tests, ~500ms
               └──────────────┬──────────────┘
                              │
               ┌──────────────┴──────────────┐
               │      Core Unit Tests        │  (packages/manifest)
               │ Schema validation & parsing │  25+ tests, ~50ms
               └─────────────────────────────┘
```

### 1.1 Core Unit Tests (`packages/manifest`)

- **Focus**: Rapid validation of raw JSON inputs against `SkillManifestSchema`.
- **Coverage**: Kebab-case regex boundaries, SemVer strings, missing mandatory keys, discriminated injection unions, and path-specific Zod error formatting.

### 1.2 AST Transform Tests (`packages/ast-engine`)

- **Focus**: Isolated verification of syntactic code transformations using `ts-morph`.
- **Coverage**:
  - `import-injector`: Adding symbols to empty files, merging into existing clauses without duplication, positioning below `'use client'`.
  - `jsx-wrapper-injector`: Wrapping children of `<body>`, wrapping outermost JSX tags, asserting absolute idempotency on repeat runs.
  - `export-reexport-injector`: Appending barrel re-exports without duplicates.
  - `engine`: Dry-run mode verification, in-memory rollback on syntax errors, Prettier formatting pass.

### 1.3 Fixture End-to-End Tests (`apps/cli` & `apps/mcp-server`)

- **Focus**: Complete lifecycle verification against realistic application fixtures on disk.
- **Coverage**: Project detection, template copying, AST layout patching, `.env.local` appending, lockfile tracking, and MCP tool serialization.

---

## 2. Test Matrix Setup with Vitest

All monorepo packages use **Vitest** for fast, native ESM test execution.

### 2.1 Workspace Test Commands

Workspaces can be tested individually or orchestrated globally via **Turborepo**:

```bash
# Run all tests across the monorepo (with Turborepo caching)
pnpm test

# Run tests for specific packages
pnpm --filter @vibe-skill/manifest test
pnpm --filter @vibe-skill/ast-engine test
pnpm --filter @vibe-skill/cli test
pnpm --filter @vibe-skill/mcp-server test

# Run in interactive watch mode during development
pnpm --filter @vibe-skill/ast-engine test --watch
```

---

## 3. AST Fixture Testing Guide

To test code modifications safely without polluting repository fixtures, tests use isolated temporary directories:

### 3.1 Fixture Isolation Pattern

```typescript
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("CLI Fixture Integration", () => {
  let tempAppDir: string;
  const fixturePath = path.resolve(__dirname, "../fixtures/sample-app");

  beforeEach(() => {
    // 1. Create a pristine temporary directory
    tempAppDir = fs.mkdtempSync(path.join(os.tmpdir(), "vibe-skill-test-"));
    // 2. Copy baseline Next.js fixture into temp folder
    fs.cpSync(fixturePath, tempAppDir, { recursive: true });
  });

  afterEach(() => {
    // 3. Clean up temporary directory after each test
    fs.rmSync(tempAppDir, { recursive: true, force: true });
  });

  it("verifies idempotent AST mutations on layout.tsx", async () => {
    // Execute test mutations against tempAppDir...
  });
});
```

### 3.2 Key Testing Assertions

When authoring tests for new skills or transformers, always assert:

1. **Directive Integrity**: Ensure `'use client'` remains on Line 1.
2. **Idempotency Count**: Count regex matches of the wrapper component (e.g. `(content.match(/AuthProvider/g) || []).length`) across repeated runs.
3. **Environment Safety**: Verify missing keys are appended to `.env.local` while pre-existing keys remain untouched.
4. **Lockfile Record**: Verify `.vibe-skill/installed.json` is updated with accurate metadata.

---

## 4. CI/CD Pipeline Execution

Every pull request and push to `main` triggers our automated GitHub Actions workflow in `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  validate:
    name: Build, Lint & Test
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 12.15.0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: "pnpm"

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run Lint
        run: pnpm lint

      - name: Run Build
        run: pnpm build

      - name: Run Tests
        run: pnpm test
```

### CI Pass Criteria:

- `pnpm lint`: Zero TypeScript type errors across all packages.
- `pnpm build`: Zero tsup or tsc compilation failures.
- `pnpm test`: All unit and integration tests exit with code 0.
