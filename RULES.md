# Antigravity: Engineering Standards & Execution Rules

This document defines the mandatory engineering standards, TypeScript compilation rules, AST transformation guardrails, Git conventions, and error-handling contracts for all contributors and automated agents working in the **Antigravity (Vibe Skill)** monorepo.

---

## 1. Strict TypeScript Standards

All packages in the monorepo inherit from [`packages/tsconfig/base.json`](file:///Users/sanjeetkaul/Downloads/Vibe-Skill/packages/tsconfig/base.json) and must compile with strict compiler enforcements enabled.

### 1.1 Compiler Enforcements

- **`strict: true`**: Full strict suite enabled (`noImplicitAny`, `strictNullChecks`, `strictFunctionTypes`, `strictBindCallApply`, `strictPropertyInitialization`, `noImplicitThis`, `alwaysStrict`).
- **`target: "ES2022"`** & **`module: "NodeNext"`**: Pure modern ECMAScript module resolution.
- **`noUnusedLocals: true`** & **`noUnusedParameters: true`**: Dead code and unused function arguments are treated as compile-time errors.
- **`exactOptionalPropertyTypes: true`**: Optional keys (`key?: string`) cannot be explicitly assigned `undefined` unless specified as `string | undefined`.

### 1.2 Prohibited Type Patterns

```typescript
// ❌ STRICTLY FORBIDDEN: Any-casting or escape hatches
const rawData = response.json() as any;
function processItem(item: any): void { ... }

// ❌ FORBIDDEN: Non-null assertions without preceding validation
const element = sourceFile.getDefaultExportSymbol()!;

// ✅ MANDATORY: Type narrowing and explicit guardrails
const defaultExport = sourceFile.getDefaultExportSymbol();
if (!defaultExport) {
  return { success: false, errors: ["Target file missing default export."] };
}

// ✅ MANDATORY: Zod schema parsing for untrusted data
const result = SkillManifestSchema.safeParse(rawJson);
if (!result.success) {
  return { success: false, errors: formatZodError(result.error) };
}
```

### 1.3 Explicit Return Signatures

All exported functions, methods, and public API interfaces must declare explicit return types:

```typescript
// ❌ Discouraged: Inferred return type
export function detectProject(targetDir: string) { ... }

// ✅ Mandatory: Explicit return interface
export function detectProject(targetDir: string): ProjectInfo { ... }
```

---

## 2. AST Transformation Safety Rules

The `@vibe-skill/ast-engine` operates directly on user application code. Careless mutations risk corrupting user codebases. Every transformer must adhere to four safety imperatives:

### Rule 2.1: Never Replace Whole Files When a Transformer Exists

- Never overwrite a file with raw boilerplate when an AST transformer is available.
- If a project already has a `src/app/layout.tsx`, the engine must inject imports and wrap JSX tags in-place rather than replacing the layout.

### Rule 2.2: Directive & Comment Integrity

- **Top-of-File Directives**: Directives such as `'use client'`, `'use server'`, and `/* eslint-disable */` must remain anchored at the very top of the file (before any injected import statements).
- **Comment Preservation**: Existing JSDoc blocks, inline explanations, and license headers must never be discarded or reordered.

### Rule 2.3: Prettier Formatting Guarantee

- Every source file modified by `ts-morph` must be formatted via Prettier before being written to disk:
  ```typescript
  const formatted = await prettier.format(sourceFile.getFullText(), {
    parser: "typescript",
    ...prettierConfig,
  });
  await fs.writeFile(filePath, formatted, "utf8");
  ```

### Rule 2.4: Compiler Diagnostic Pre-Check

- Before saving any mutated source file, the engine must verify that no syntax errors were introduced:
  ```typescript
  const diagnostics = sourceFile.getPreEmitDiagnostics();
  const syntaxErrors = diagnostics.filter(
    (d) => d.getCategory() === DiagnosticCategory.Error,
  );
  if (syntaxErrors.length > 0) {
    throw new Error(
      `Syntax error introduced during AST transformation: ${syntaxErrors[0].getMessageText()}`,
    );
  }
  ```

---

## 3. Git & Versioning Conventions

### 3.1 Conventional Commits

All commit messages must follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```text
<type>(<scope>): <short summary>

[optional body]

[optional footer(s)]
```

| Type           | When to Use                                   | Example                                                     |
| :------------- | :-------------------------------------------- | :---------------------------------------------------------- |
| **`feat`**     | Adding new features, skills, or commands      | `feat(cli): add dry-run mode to skill installer`            |
| **`fix`**      | Bug fixes in engine, schemas, or CLI          | `fix(ast-engine): prevent duplicate named import insertion` |
| **`docs`**     | Architecture, design, specs, or guide changes | `docs: establish operational governance rules`              |
| **`chore`**    | Monorepo maintenance, dependencies, tooling   | `chore(deps): update pnpm to 12.15.0`                       |
| **`refactor`** | Code refactoring without behavior changes     | `refactor(manifest): extract kebab-case regex validator`    |
| **`test`**     | Adding or modifying unit/e2e test suites      | `test(mcp): add programmatic tool inspection fixtures`      |

### 3.2 Branching Strategy

- **`main`**: The primary production and release trunk. Always deployable and tested.
- **`feat/phase-*`** or **`feat/<feature-name>`**: Short-lived feature branches for major phases or isolated capabilities.
- **`fix/<issue-name>`**: Targeted bug fix branches.
- **Pull Request Hygiene**: All PRs must pass `pnpm format:check`, `pnpm lint`, `pnpm build`, and `pnpm test` before merging.

---

## 4. Error Handling Contracts

Uncaught exceptions and unhandled promise rejections degrade developer trust and break AI agent loops. Antigravity mandates structured error contracts.

### 4.1 Discriminated Union Return Types

All public API functions across the monorepo must return a discriminated union indicating success or failure:

```typescript
export type Result<T, E = string> =
  | { success: true; data: T; errors?: never }
  | { success: false; data?: never; errors: E[] };
```

#### Example Implementation

```typescript
// packages/manifest/src/validator.ts
export type ValidationResult =
  { success: true; data: SkillManifest } | { success: false; errors: string[] };

export function validateManifest(json: unknown): ValidationResult {
  const result = SkillManifestSchema.safeParse(json);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: formatZodError(result.error) };
}
```

### 4.2 Safe Execution Primitives

1. **No Silent Failures**: Never catch an error with an empty block (`catch {}`). Either recover cleanly or forward formatted diagnostics in the `errors` array.
2. **Context-Rich Error Messages**: Error strings must include the target file path, skill ID, or missing key so developers or agents can resolve the issue immediately.
3. **Atomic Operations**: If a multi-step operation fails halfway through, the engine must revert all intermediate modifications before returning `{ success: false, errors: [...] }`.
