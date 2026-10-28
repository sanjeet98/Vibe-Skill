---
trigger: always_on
description: Mandatory rule to keep every file, spec, test, and doc up to date whenever changes happen in the codebase.
---

# Continuous File Currency & Synchronization Invariant

> **MANDATORY POLICY**: Every file in this codebase must remain 100% synchronized and current. When changes occur in any file, all dependent documentation, specifications, schemas, tests, and changelog entries MUST be updated in the same turn.

---

## 1. The File Dependency & Synchronization Matrix

Whenever a file in the **Source / Trigger** column is modified, the agent MUST immediately inspect and update all corresponding files in the **Mandatory Dependent Updates** column before concluding the task:

| Trigger File / Area Changed                                       | Mandatory Dependent Updates Required                                                                                                                                                                                                                                                                                                                                      |
| :---------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **`packages/manifest/src/schema.ts`** or manifest types           | • `docs/specs/skill-schema-spec.md` (Update schema specification tables)<br/>• `docs/specs/001-manifest-schema.md` (Update architecture RFC)<br/>• `packages/manifest/tests/manifest.test.ts` (Update / add schema unit tests)<br/>• `ARCHITECTURE.md` (Update Manifest responsibilities)<br/>• `CHANGELOG.md` (Record change under `[Unreleased]`)                       |
| **`packages/ast-engine/src/**`** (Transformers or Engine)         | • `packages/ast-engine/tests/ast-engine.test.ts` (Add unit test fixtures)<br/>• `DESIGN.md` (Update idempotency & non-destructive mutation specs)<br/>• `FLOW.md` (Update AST transformation state machine stage 4)<br/>• `ARCHITECTURE.md` (Update engine component documentation)<br/>• `CHANGELOG.md` (Record change under `[Unreleased]`)                             |
| **`apps/cli/src/**`** (CLI commands, flags, prompts)              | • `apps/cli/tests/cli.test.ts` (Update CLI E2E tests)<br/>• `README.md` (Update CLI Usage Showcase)<br/>• `ARCHITECTURE.md` (Update CLI command breakdown)<br/>• `FLOW.md` (Update installation flow)<br/>• `MEMORY.md` (Update lockfile & checkpoint interaction)<br/>• `CHANGELOG.md` (Record change under `[Unreleased]`)                                              |
| **`apps/mcp-server/src/**`** (MCP tools, catalog, transport)      | • `apps/mcp-server/tests/mcp-server.test.ts` (Update MCP tool tests)<br/>• `docs/specs/mcp-configuration.md` (Update MCP client config guides)<br/>• `README.md` (Update MCP Server Integration section)<br/>• `FLOW.md` (Update MCP sequence diagram)<br/>• `ARCHITECTURE.md` (Update MCP component breakdown)<br/>• `CHANGELOG.md` (Record change under `[Unreleased]`) |
| **`skills/<skill-id>/**`** (Skill blueprints, templates, SQL)     | • `skills/<skill-id>/skill.json` (Verify against manifest schema)<br/>• `skills/<skill-id>/agent/rules.md` (Update agent rules)<br/>• `README.md` (Update Canonical Skills catalog listing)<br/>• `apps/cli/tests/cli.test.ts` (Ensure canonical skill fixture tests pass)<br/>• `CHANGELOG.md` (Record change under `[Unreleased]`)                                      |
| **Architectural / Design Shifts**                                 | • `ARCHITECTURE.md` (Update system design and interaction diagrams)<br/>• `DESIGN.md` (Update scaffolding philosophy & idempotency)<br/>• `FLOW.md` (Update lifecycle state machines)<br/>• `DECISIONS.md` (Record new Architectural Decision Record - ADR)<br/>• `AGENTS.md` & `RULES.md` (Update operational agent constraints)                                         |
| **Security / Audit Policies**                                     | • `SECURITY.md` (Update threat vectors, secret rules, static sanitization)<br/>• `AUDIT.md` (Update checklist and 100-point scoring matrix)<br/>• `.github/workflows/ci.yml` (Ensure CI reflects audit checks)                                                                                                                                                            |
| **Testing Strategy & Matrix**                                     | • `TESTING.md` (Update testing hierarchy and command matrix)<br/>• Relevant `tests/*.test.ts` across affected packages                                                                                                                                                                                                                                                    |
| **State Persistence / Lockfiles** (`installed.json`, checkpoints) | • `apps/cli/src/utils/project.ts` (Update lockfile I/O)<br/>• `apps/mcp-server/src/tools/skills.ts` (Update lockfile writing)<br/>• `MEMORY.md` (Update schema & rollback checkpoint ledger)                                                                                                                                                                              |
| **Package / Monorepo Version Bumps**                              | • Root `package.json` & all `packages/*/package.json`, `apps/*/package.json`<br/>• `pnpm-lock.yaml` (Run `pnpm install`)<br/>• `CHANGELOG.md` (Promote `[Unreleased]` to version header with ISO date)                                                                                                                                                                    |

---

## 2. Pre-Completion Verification Protocol

Before declaring any coding or documentation task complete, the agent MUST run the following sequence:

1. **Change Audit**: Execute `git status` to inspect all modified and untracked files.
2. **Dependency Sweep**: Cross-reference every modified file against the Matrix above and apply all required cascading updates.
3. **Format**: Run `pnpm format` to format code, markdown, and JSON files via Prettier.
4. **Lint**: Run `pnpm lint` (`tsc --noEmit`) to verify zero TypeScript compiler errors.
5. **Test**: Run `pnpm test` to ensure all 49+ unit, transform, and integration tests pass.
6. **Changelog**: Confirm `CHANGELOG.md` contains an accurate entry describing the changes.
