# Antigravity: Code Quality, Safety, & Operational Rules

> Mandatory engineering rules, TypeScript standards, AST transformation invariants, Git conventions, and error handling contracts for the Antigravity codebase.

---

## 1. Strict TypeScript Standards

All monorepo packages (`packages/*`, `apps/*`, and `skills/*`) must maintain zero compiler errors under strict TypeScript compiler rules.

### 1.1 Strict Compiler Settings

All `tsconfig.json` configurations must extend `packages/tsconfig/base.json` and enforce:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

### 1.2 Ban on Unsafe Type Assertions (`as any`)

- **`as any` is strictly prohibited** across all production and test code.
- If handling unknown external data (e.g., raw JSON manifests, CLI arguments, or network responses):
  - Type the value as `unknown`.
  - Validate it using a Zod schema (`SkillManifestSchema.safeParse(json)`).
  - Alternatively, write explicit TypeScript custom type guards (`function isRecord(val: unknown): val is Record<string, unknown>`).
- Use `as const` where literal types are required.

---

## 2. AST Transformation Safety & Invariants

Modifying user code requires extreme caution. All transformers inside `packages/ast-engine` must adhere to these non-negotiable invariants:

### 2.1 Never Overwrite Whole Files

- When an injection target already exists (e.g., `src/app/layout.tsx`), the engine must parse the AST and manipulate _only_ the specific AST nodes (e.g., imports or JSX tags).
- Whole-file overwrites are restricted solely to new template files being placed in new locations (e.g., `src/components/auth-provider.tsx`).

### 2.2 Invariant of Directive & Comment Preservation

- Top-of-file directives (`'use client'`, `'use server'`, `/* eslint-disable */`) must remain at the very top of the file.
- Injected imports must be inserted _after_ directives, never before them.
- JSDocs, function comments, and inline annotations must never be stripped or moved during AST node traversal.

### 2.3 Mandatory Prettier Formatting Pass

- Raw AST node string outputs often contain irregular indentation or spacing.
- Every modified file must pass through `prettier.format(content, { parser: "typescript" })` before being saved to disk.

### 2.4 Absolute Idempotency

- Re-running an AST transformer on an already-modified file must produce **zero diffs**.
- Import injectors must inspect existing imports before adding symbols.
- JSX wrappers must inspect parent/child tags to verify if the wrapper already exists.
- Barrel injectors must inspect existing `export *` statements.

---

## 3. Git & Versioning Conventions

### 3.1 Conventional Commits

All commit messages must strictly adhere to the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```text
<type>(<scope>): <short description in present tense>

[optional body]

[optional footer(s)]
```

#### Allowed Types:

- `feat:` Introducing a new feature, skill blueprint, or CLI command.
- `fix:` Fixing a bug or syntax transformation issue.
- `chore:` Maintenance, monorepo tooling updates, or dependency bumps.
- `docs:` Documentation, specifications, ADRs, or README updates.
- `refactor:` Code restructuring without behavioral changes.
- `test:` Adding or updating unit tests, fixtures, or test harnesses.
- `style:` Formatting or style adjustments with zero logic modification.

#### Allowed Scopes:

`manifest`, `ast-engine`, `infra-core`, `cli`, `mcp-server`, `skills`, `docs`, `config`.

_Examples:_

- `feat(ast-engine): implement idempotent jsx-wrapper transformer`
- `fix(cli): resolve relative skill paths when invoked with --cwd`
- `docs(adr): record architectural decision for ts-morph adoption`

### 3.2 Branching Strategy

- **`main`**: The primary source of truth. Contains production-grade, tested code. All releases and tags stem from `main`.
- **`develop`**: Used in collaborative team sprints as the active integration branch.
- **`feat/phase-*`**: Feature branches for specific phases (e.g., `feat/phase-1-manifest`, `feat/phase-2-ast-engine`).
- **Pull Request Rule**: Feature branches must pass `pnpm format:check`, `pnpm lint`, `pnpm build`, and `pnpm test` in GitHub Actions CI before merging.

---

## 4. Error Handling Contracts

Public functions in `@antigravity/manifest`, `@antigravity/ast-engine`, `@antigravity/infra-core`, and all CLI/MCP commands must never throw unhandled exceptions or return untyped errors.

### 4.1 Structured Result Pattern

Public APIs must return structured, discriminated union result objects:

```typescript
export type Result<T, E = string[]> =
  | { success: true; data: T; errors?: never }
  | { success: false; errors: E; data?: never };
```

#### Manifest Validation Contract:

```typescript
export type ValidationResult =
  { success: true; data: SkillManifest } | { success: false; errors: string[] };

export function validateManifest(json: unknown): ValidationResult;
```

#### AST Injection Contract:

```typescript
export interface InjectionResult {
  success: boolean;
  mutatedFiles: Array<{ filePath: string; hasChanged: boolean }>;
  errors: string[];
}

export function applyInjections(
  projectRoot: string,
  injections: SkillInjection[],
  options?: InjectionOptions,
): Promise<InjectionResult>;
```

### 4.2 Error Reporting Standards

- Errors must pinpoint the exact JSON path or file line causing the failure.
- Example: Instead of `"Validation failed"`, report `"injections.0.wrapperComponent: Required"`.
- In CLI and MCP tools, catch all exceptions and format them into readable diagnostics with actionable recovery steps rather than printing raw stack traces.

---

## 5. Continuous File Currency & Synchronization Rule

### 5.1 The Golden Invariant of Documentation & Code Sync

> **Whenever changes occur in ANY file in this codebase, all corresponding dependent files across documentation, specifications, schemas, lockfiles, tests, and changelogs MUST be updated in the same turn/commit.**

No file may be left in an obsolete, stale, or conflicting state.

### 5.2 Mandatory Dependency Matrix

1. **Manifest & Types (`packages/manifest/**`)**:
   - Must synchronize: `docs/specs/skill-schema-spec.md`, `docs/specs/001-manifest-schema.md`, `packages/manifest/tests/`, `ARCHITECTURE.md`, `CHANGELOG.md`.
2. **AST Transformers & Engine (`packages/ast-engine/**`)**:
   - Must synchronize: `packages/ast-engine/tests/`, `DESIGN.md`, `FLOW.md`, `ARCHITECTURE.md`, `CHANGELOG.md`.
3. **CLI Commands & Flags (`apps/cli/**`)**:
   - Must synchronize: `apps/cli/tests/`, `README.md`, `ARCHITECTURE.md`, `FLOW.md`, `MEMORY.md`, `CHANGELOG.md`.
4. **MCP Server Tools (`apps/mcp-server/**`)**:
   - Must synchronize: `apps/mcp-server/tests/`, `docs/specs/mcp-configuration.md`, `README.md`, `ARCHITECTURE.md`, `FLOW.md`, `CHANGELOG.md`.
5. **Skill Blueprints (`skills/**`)**:
   - Must synchronize: `skill.json`, `agent/rules.md`, `README.md`, integration tests, `CHANGELOG.md`.
6. **Architecture & Philosophy**:
   - Must synchronize: `ARCHITECTURE.md`, `DESIGN.md`, `FLOW.md`, `DECISIONS.md` (record new ADR), `AGENTS.md`, `RULES.md`.
7. **State Persistence & Lockfiles**:
   - Must synchronize: `MEMORY.md`, `apps/cli/src/utils/project.ts`, `apps/mcp-server/src/tools/skills.ts`.
8. **Security & Auditing**:
   - Must synchronize: `SECURITY.md`, `AUDIT.md`, `.github/workflows/ci.yml`.
9. **Testing**:
   - Must synchronize: `TESTING.md` and package test suites.
10. **Releases & Version Bumps**:
    - Must synchronize: root and package `package.json` files, `pnpm-lock.yaml`, `CHANGELOG.md`.

### 5.3 Pre-Completion Verification Gate

Before closing any issue, pull request, or prompt turn, the developer or agent must run:

```bash
pnpm format && pnpm format:check && pnpm lint && pnpm test && pnpm build
```

All tasks must succeed with zero errors.
