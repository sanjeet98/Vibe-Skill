# Antigravity: Workspace Rules & Operational Invariants

> Project rules and operational mandates automatically discovered and enforced across the Antigravity (Vibe Skill) workspace.

---

## 1. Continuous File Currency & Synchronization Rule

**Invariant**: Every file in this codebase must remain current and synchronized. Whenever changes occur in any file, all corresponding documentation, specifications, schemas, tests, and changelog entries MUST be updated in the same turn.

### Mandatory Synchronization Matrix:

- **`packages/manifest/**` modified**: Update `docs/specs/skill-schema-spec.md`, `docs/specs/001-manifest-schema.md`, `ARCHITECTURE.md`, `packages/manifest/tests/`, `CHANGELOG.md`.
- **`packages/ast-engine/**` modified**: Update `DESIGN.md`, `FLOW.md`, `ARCHITECTURE.md`, `packages/ast-engine/tests/`, `CHANGELOG.md`.
- **`apps/cli/**` modified**: Update `README.md`, `ARCHITECTURE.md`, `FLOW.md`, `MEMORY.md`, `apps/cli/tests/`, `CHANGELOG.md`.
- **`apps/mcp-server/**` modified**: Update `docs/specs/mcp-configuration.md`, `README.md`, `ARCHITECTURE.md`, `FLOW.md`, `apps/mcp-server/tests/`, `CHANGELOG.md`.
- **`skills/**` modified**: Update `skills/<id>/skill.json`, `skills/<id>/agent/rules.md`, `README.md`, fixture tests, `CHANGELOG.md`.
- **Architectural/Design Shift**: Record new ADR in `DECISIONS.md`; update `ARCHITECTURE.md`, `DESIGN.md`, `FLOW.md`, `AGENTS.md`, `RULES.md`.
- **State / Lockfile Shift**: Update `MEMORY.md`, `apps/cli/src/utils/project.ts`, `apps/mcp-server/src/tools/skills.ts`.
- **Security / Audit Shift**: Update `SECURITY.md`, `AUDIT.md`, `.github/workflows/ci.yml`.
- **Testing Shift**: Update `TESTING.md` and package test suites.
- **Version Bump**: Update `package.json` across packages, `pnpm-lock.yaml`, and `CHANGELOG.md`.

---

## 2. Strict Code Quality & Safety Rules

1. **Strict TypeScript Standards**: `noImplicitAny: true`, strict null checks, no `as any`.
2. **AST Transformation Safety**: Never use raw string search-and-replace for structural code scaffolding; use `@antigravity/ast-engine` or MCP `install_skill`. Preserve all comments, JSDocs, and `'use client'`/`'use server'` directives.
3. **Prettier Formatting**: All modified files must be formatted with Prettier before saving to disk.
4. **Idempotency Guarantee**: Repeated execution of skill additions must result in zero subsequent diffs.
5. **Git Conventions**: Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`, `style:`).
6. **Pre-Completion Verification**: Every turn must pass `pnpm format:check`, `pnpm lint`, and `pnpm test` (all 49+ tests passing) before concluding.
