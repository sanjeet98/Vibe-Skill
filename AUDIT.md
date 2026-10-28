# Vibe Skill: Verification, Quality Auditing, & Compliance Framework

> Pre-release audit checklists, registry compliance scoring, and automated supply-chain security auditing for the Vibe Skill platform.

---

## 1. Pre-Release Audit Checklist

Before tagging or releasing any core package (`packages/*`), CLI binary (`apps/cli`), MCP server (`apps/mcp-server`), or canonical reference skill (`skills/*`), release engineers and CI pipelines must verify the following checklist:

### Pre-Release Gatekeeper Checklist

- [ ] **Manifest Schema Strictness**: All manifests (`skill.json`) pass `validateManifest()` from `@vibe-skill/manifest` with zero validation errors.
- [ ] **Compiler Diagnostics Audit**: `pnpm lint` (`tsc --noEmit`) passes with zero errors across all workspaces under strict compiler flags (`noImplicitAny`, `strictNullChecks`).
- [ ] **Idempotency Verification**: Running AST injection passes repeatedly (Pass 1, Pass 2, Pass 3) produces **zero diffs** after the initial injection.
- [ ] **Directive & Comment Preservation**: Testing confirms `'use client'`, `'use server'`, and JSDoc blocks are preserved without repositioning.
- [ ] **Full Test Suite Green**: `pnpm test` (all 49+ Vitest tests) passes 100% across all monorepo packages.
- [ ] **Dependency Hygiene**: `pnpm audit --prod` reports zero high- or critical-severity vulnerabilities.
- [ ] **Code Formatting**: `pnpm format:check` reports 100% Prettier compliance across all TypeScript, JSON, and Markdown files.
- [ ] **Clean Build Artifacts**: `pnpm build` bundles clean standalone executables and type definitions without circular import warnings.

---

## 2. Skill Registry Compliance Scoring

To maintain a secure, high-quality ecosystem, all community and third-party skills submitted to the Vibe Skill Registry are evaluated against an objective, 100-point compliance rubric:

```text
┌─────────────────────────────────────────────────────────────┐
│             Skill Compliance Scoring Matrix                 │
├─────────────────────────────────────────────────────────────┤
│ 1. Manifest Schema Validity              │  25 Points       │
│ 2. AST Dry-Run & Idempotency Test        │  25 Points       │
│ 3. Dependency Graph & Package Hygiene    │  20 Points       │
│ 4. Security & Secret Protection          │  15 Points       │
│ 5. Agent Architectural Guidelines        │  15 Points       │
├─────────────────────────────────────────────────────────────┤
│ Total Possible Score                     │ 100 Points       │
└─────────────────────────────────────────────────────────────┘
```

### Rubric Breakdown

#### 2.1 Manifest Schema Validity (25 Points)

- **25 pts**: Full compliance with `@vibe-skill/manifest` schema; valid kebab-case ID, valid SemVer, explicit compatibility matrix, and fully discriminated injection types.
- **0 pts**: Any schema violation or unhandled property.

#### 2.2 AST Dry-Run & Idempotency Test (25 Points)

- **25 pts**: Injections execute cleanly in-memory against standard Next.js / Vite fixtures; syntax diagnostics pass 100%; repeat runs produce zero diffs.
- **10 pts**: Injections apply but fail idempotency (duplicate imports on second run).
- **0 pts**: Syntax errors or broken JSX tag hierarchies introduced.

#### 2.3 Dependency Graph & Package Hygiene (20 Points)

- **20 pts**: All npm dependencies have explicit SemVer ranges; zero circular dependencies; zero deprecated packages; minimal transitive dependency footprint.
- **10 pts**: Missing peer dependency specifications.
- **0 pts**: Known vulnerable or unmaintained packages referenced.

#### 2.4 Security & Secret Protection (15 Points)

- **15 pts**: All sensitive environment keys explicitly marked `"secret": true`; no plain-text tokens or keys embedded in templates; zero use of `eval()` or un-sanitized child processes.
- **0 pts**: Plain-text secrets present, or dangerous dynamic code evaluation detected.

#### 2.5 Agent Architectural Guidelines Quality (15 Points)

- **15 pts**: Includes a detailed `agent/rules.md` providing architectural context, session querying guidelines, server-action conventions, and verification instructions for AI agents.
- **5 pts**: Minimal or generic rules documentation.
- **0 pts**: Missing `rules.md`.

### Registry Tier Thresholds

- **Certified (90–100 Points)**: Featured in official catalogs; pre-installed in default agent tool sets.
- **Community Verified (75–89 Points)**: Available in public search; tagged as verified community contribution.
- **Experimental (<75 Points)**: Requires explicit `--force` flag to install; excluded from automatic agent discovery.

---

## 3. Automated Audit Workflow

Vibe Skill integrates continuous automated auditing into development and CI pipelines:

### 3.1 Supply-Chain Vulnerability Scanning

Run regular dependency audits across all workspace packages:

```bash
# Audit production dependencies for vulnerabilities
pnpm audit --prod

# Detailed audit including dev dependencies
pnpm audit
```

### 3.2 Test Coverage Enforcement

We enforce strict test coverage targets for core packages:

- **`packages/ast-engine`**: Target `>85%` line and branch coverage.
- **`packages/manifest`**: Target `>90%` schema validation coverage.
- **`apps/cli` & `apps/mcp-server`**: Target `>80%` command and tool handler coverage.

Run coverage reports via Vitest:

```bash
# Execute test suite with coverage collection
pnpm test -- --coverage
```

### 3.3 Continuous Integration Gate

The GitHub Actions workflow in `.github/workflows/ci.yml` serves as the automated gatekeeper. Pull requests cannot be merged if any audit, lint, build, or test task fails.
