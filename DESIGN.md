# Vibe Skill: Design Principles & Engineering Philosophy

> "Deterministic Code Scaffolding > Probabilistic Code Generation."

This document details the architectural principles, idempotency guarantees, non-destructive mutation models, and zero-trust security postures that govern the Vibe Skill engine.

---

## 1. Core Philosophy: Deterministic vs. Probabilistic Code Modification

### The Fundamental Flaw of Text-Generating LLMs

Large Language Models (LLMs) operate on token probabilities rather than semantic syntax graphs. When tasked with modifying an existing codebase, an LLM generates a text stream that predicts what the file _should_ look like. While this works well for greenfield prototypes, it degrades rapidly in established, mission-critical production systems:

| Characteristic             | Probabilistic (Raw LLM Patching)            | Deterministic (Vibe Skill AST Engine)                      |
| :------------------------- | :------------------------------------------ | :--------------------------------------------------------- |
| **Code Representation**    | Unstructured text strings                   | Concrete Syntax Tree (AST) node graph                      |
| **Import Management**      | Frequently duplicates or collides imports   | Surgically merges identifiers into existing import clauses |
| **Syntactic Integrity**    | Can drop closing tags, braces, or commas    | Guaranteed valid TypeScript AST before writing to disk     |
| **Formatting & Style**     | Inconsistent spacing; conflicts with linter | Preserved formatting with automated Prettier pass          |
| **Directive Preservation** | May strip `'use client'` or header comments | Top-of-file directives and comments are strictly anchored  |
| **Repeatability**          | Non-deterministic; re-running yields diffs  | 100% idempotent; identical input produces identical output |
| **Failure Mode**           | Half-applied, syntactically broken files    | Atomic rollback: either 100% successful or 0% applied      |

### The Separation of Concerns

Vibe Skill enforces a strict division of responsibility between the reasoning agent and the compiler engine:

```
┌──────────────────────────────────────────────┐
│           AI Agent Responsibility            │
│  • Understand user intent                    │
│  • Select appropriate skill blueprint        │
│  • Plan file placements & route design       │
│  • Provide contextual application logic      │
└──────────────────────┬───────────────────────┘
                       │ High-level Intent & Manifest
                       ▼
┌──────────────────────────────────────────────┐
│        Vibe Skill Engine Responsibility      │
│  • Parse TypeScript Abstract Syntax Trees    │
│  • Safely inject providers, middleware, barrels│
│  • Verify compiler syntax diagnostics       │
│  • Format code via Prettier                  │
│  • Atomic commit or rollback on failure      │
└──────────────────────────────────────────────┘
```

---

## 2. Idempotency Guarantee

A core mandate of Vibe Skill is that **running a skill installation multiple times must produce the exact same codebase state as running it once**.

### 2.1 Import Injection Idempotency (`import-injector.ts`)

When injecting an import such as `import { AuthProvider } from '@/components/auth-provider';`:

1. The engine scans all existing `ImportDeclaration` nodes in the target source file.
2. If an import declaration matching the module specifier (`@/components/auth-provider`) already exists:
   - It iterates through `getNamedImports()`.
   - If the named specifier (`AuthProvider`) is already present, the injection terminates immediately with **zero modification**.
   - If the module exists but the identifier is missing, it cleanly appends `, AuthProvider` into the existing import clause without creating duplicate statements.
3. If no matching module specifier exists, the import is appended at the top of the file, safely positioned below any `'use client'` or `'use server'` directives.

### 2.2 JSX Wrapper Idempotency (`jsx-wrapper-injector.ts`)

When wrapping a root layout component with a context provider (e.g., wrapping Next.js `layout.tsx` in `<AuthProvider>...</AuthProvider>`):

1. The engine locates the default exported React component (e.g., `RootLayout`).
2. It traverses the return statement's JSX tree to locate the target container (preferring the `<body>` element if present, or the outermost JSX element).
3. The engine inspects the descendants and parent chain:
   - If the target container is already wrapped by an element with the identifier `AuthProvider`, the transformer detects prior execution and exits cleanly.
4. If not wrapped, the inner JSX children are wrapped, preserving all existing attributes (`className`, `id`, `style`) on the container tag.

```tsx
// Before Injection
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}

// After Pass 1 (Surgically Wrapped)
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}

// After Pass 2, 3, ... N
// Identified as already wrapped: NO CHANGES MADE
```

### 2.3 Barrel Re-Export Idempotency (`export-reexport-injector.ts`)

When skills register new database schema tables (e.g., `src/db/schema/roles.ts` exporting to `src/db/schema/index.ts`):

1. The transformer scans all `ExportDeclaration` nodes.
2. It checks for matching `moduleSpecifier` (e.g., `./roles`).
3. If `export * from './roles'` already exists, no duplicate export is added.

---

## 3. Non-Destructive Mutation & Rollback Guardrails

Vibe Skill treats existing user code as immutable except at designated injection points.

### 3.1 Directive and Comment Preservation

TypeScript/Next.js codebases rely heavily on compiler directives. Replacing files via string replacement often detaches directives from the file root, causing silent build failures. Vibe Skill:

- Extracts leading comments and directives (`'use client'`, `'use server'`, `/* eslint-disable */`).
- Inserts new imports immediately after directives, never before them.
- Preserves all JSDoc annotations and inline comments attached to existing functions and classes.

### 3.2 In-Memory Checkpoints & Atomic Rollback

Every file transformation cycle executed by `@vibe-skill/ast-engine` follows an atomic transaction pattern:

```
                  ┌───────────────────────────────┐
                  │   Receive Injection Request   │
                  └───────────────┬───────────────┘
                                  │
                                  ▼
                  ┌───────────────────────────────┐
                  │   Create In-Memory Snapshots   │
                  │  (Map<FilePath, OriginalText>) │
                  └───────────────┬───────────────┘
                                  │
                                  ▼
                  ┌───────────────────────────────┐
                  │    Execute AST Transformers   │
                  └───────────────┬───────────────┘
                                  │
                  ┌───────────────┴───────────────┐
         Success  │                               │ Failure / Exception
                  ▼                               ▼
    ┌───────────────────────────┐   ┌───────────────────────────┐
    │ Verify Syntax Diagnostics │   │     Trigger Rollback      │
    └─────────────┬─────────────┘   │ (Restore all files from   │
                  │                 │  in-memory snapshots)     │
        Pass      │      Fail       └─────────────┬─────────────┘
        ┌─────────┴─────────┐                     │
        ▼                   ▼                     ▼
  ┌───────────┐       ┌───────────┐       ┌───────────────┐
  │  Format   │       │ Rollback  │       │ Return Error  │
  │  Prettier │       │ Snapshot  │       │ & Abort Run   │
  └─────┬─────┘       └─────┬─────┘       └───────────────┘
        │                   │
        ▼                   ▼
  ┌───────────┐       ┌───────────┐
  │ Write to  │       │ Reverted  │
  │   Disk    │       │ Cleanly   │
  └───────────┘       └───────────┘
```

1. **Snapshot Phase**: Before any source file is mutated, its exact on-disk text is captured in an in-memory map.
2. **Execution Phase**: The AST is manipulated using `ts-morph`.
3. **Validation Phase**: The engine checks the resulting source file for syntax diagnostics. If a syntax error is introduced, an exception is thrown.
4. **Prettier Pass**: If valid, the modified code is formatted using Prettier.
5. **Rollback Trigger**: If _any_ transformer in the sequence fails or throws, the engine automatically iterates over all modified files and restores their original contents, leaving zero artifact pollution.

---

## 4. Zero-Trust Manifests & Sandboxed Capabilities

Third-party package managers have historically suffered from arbitrary script execution vulnerabilities (e.g., malicious `postinstall` shell hooks). Vibe Skill enforces a **Zero-Trust Manifest Model**.

### 4.1 Declarative Specifications Over Executable Code

Skills do not distribute arbitrary bash scripts. Instead, they provide a declarative `skill.json` adhering strictly to `@vibe-skill/manifest`:

```json
{
  "schemaVersion": "1.0.0",
  "id": "auth-supabase-rbac",
  "name": "Supabase Auth with RBAC",
  "version": "1.0.0",
  "compatibility": {
    "framework": "nextjs",
    "language": "typescript",
    "router": "app-router"
  },
  "dependencies": {
    "npm": {
      "@supabase/supabase-js": "^2.45.0",
      "@supabase/ssr": "^0.5.0"
    }
  },
  "env": [
    { "key": "NEXT_PUBLIC_SUPABASE_URL", "required": true, "secret": false },
    { "key": "SUPABASE_SERVICE_ROLE_KEY", "required": true, "secret": true }
  ],
  "injections": [
    {
      "type": "jsx_wrapper",
      "targetFile": "src/app/layout.tsx",
      "import": {
        "identifier": "AuthProvider",
        "module": "@/components/auth-provider"
      },
      "wrapperComponent": "AuthProvider"
    }
  ],
  "agentContext": {
    "rulesFile": "agent/rules.md"
  }
}
```

### 4.2 Security Boundaries

1. **Schema Validation Gate**: Any manifest with unrecognized properties, invalid SemVer versions, malformed kebab-case IDs, or unsupported injection types is rejected before execution.
2. **AST Mutation Whitelist**: Only supported, compiler-controlled operations (`jsx_wrapper`, `named_export`, `re_export`, `middleware_chain`) can touch source code.
3. **Secret Redaction**: Environment variables flagged with `"secret": true` are masked from agent context traces and build logs.
4. **Isolated Sandboxing**: Future pre/post lifecycle hooks are executed in an isolated WebWorker / V8 isolate runtime without access to host network or file systems beyond explicit output targets.
