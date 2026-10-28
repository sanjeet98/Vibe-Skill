# Changelog

All notable changes to the **Antigravity** (Vibe Skill) platform will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Planned

- **Phase 4 Registry Client**: Remote package resolution, tarball fetching, and cryptographic SHA-256 verification via `@vibe-skill/infra-core`.
- **Sandboxed Execution Runtime**: Isolated V8/WebWorker runtime for executing pre/post-install lifecycle verification hooks.
- **Additional Canonical Blueprints**:
  - `auth-better-auth`: Modern TypeScript authentication engine integration.
  - `db-prisma-pg`: Prisma ORM client with automated migrations.
  - `ui-shadcn-tailwind`: Shadcn UI primitives and Tailwind CSS v4 scaffolding.

---

## [0.1.0] - 2026-10-28

### Added

- **Monorepo Foundation & Tooling**:
  - Initialized high-performance monorepo using `pnpm` workspaces (v12.15+) and `Turborepo` (v2+).
  - Configured shared strict TypeScript configurations (`@vibe-skill/tsconfig`) with `ES2022` and `NodeNext` targets.
  - Established automated GitHub Actions CI pipeline (`.github/workflows/ci.yml`) for linting, building, and testing.
- **Manifest Specification Standard (`@vibe-skill/manifest`)**:
  - Implemented `SkillManifestSchema` using Zod for runtime `skill.json` validation.
  - Added strict validation for SemVer versions, kebab-case IDs, framework compatibility matrices, environment variable declarations, and discriminated injection unions.
  - Built `formatZodError` providing path-specific validation diagnostics.
  - Created 26 unit tests verifying schema boundaries.
- **Deterministic AST Engine (`@vibe-skill/ast-engine`)**:
  - Built AST transformation engine using `ts-morph` and Prettier.
  - Implemented `import-injector.ts` for clean, duplicate-free import management.
  - Implemented `jsx-wrapper-injector.ts` for idempotent component wrapping (e.g., `<AuthProvider>`).
  - Implemented `export-reexport-injector.ts` for barrel re-exports (`export * from './module'`).
  - Added in-memory rollback snapshots restoring pristine code on any compiler diagnostic failure.
  - Created 12 unit and transform tests.
- **Developer Command-Line Interface (`@vibe-skill/cli`)**:
  - Built standalone executable binary (`vibe-skill` / `antigravity`) with `Commander` and `tsup`.
  - Added `antigravity init` command for project environment and framework detection.
  - Added `antigravity add <skill>` command for atomic AST code injection and template copying.
  - Added `antigravity list` command for querying `.antigravity/installed.json` lockfiles.
  - Created end-to-end fixture tests against simulated Next.js App Router applications.
- **Model Context Protocol Server (`@vibe-skill/mcp-server`)**:
  - Built MCP-compliant server using `@modelcontextprotocol/sdk` over `stdio` transport.
  - Registered `list_available_skills`, `inspect_skill`, and `install_skill` tools for AI coding agents.
  - Created integration tests verifying agent discovery, inspection, and programmatic installation.
- **Canonical Reference Skills**:
  - `skills/auth-supabase-rbac`: Production-grade Supabase Auth with SSR middleware and Postgres RBAC migrations.
  - `skills/auth-clerk-nextjs`: Clerk authentication integration for Next.js 14 App Router.
  - `skills/db-drizzle-pg`: Drizzle ORM schema and PostgreSQL database client.
- **System Architecture & Operational Governance Documentation**:
  - Created `ARCHITECTURE.md`, `DESIGN.md`, `FLOW.md`, `DECISIONS.md`.
  - Created `AGENTS.md`, `RULES.md`, `MEMORY.md`, and updated `README.md`.
  - Created `SECURITY.md`, `AUDIT.md`, `TESTING.md`, and `CHANGELOG.md`.
