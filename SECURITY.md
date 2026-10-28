# Vibe Skill: Security Policy & Threat Modeling

> Security policies, threat vectors, secret hygiene, static AST sanitization standards, and vulnerability disclosure protocols for the Vibe Skill platform.

---

## 1. Threat Modeling & Attack Vectors

Vibe Skill operates at the intersection of autonomous AI agents, third-party code packages, and direct local file system mutations. This environment introduces unique security challenges that must be defended against:

```text
┌─────────────────────────────────┐
│     Threat Vector 1:            │
│   Malicious Skill Manifest      │ ──► [Manifest Schema & Path Traversal Validator]
└─────────────────────────────────┘
┌─────────────────────────────────┐
│     Threat Vector 2:            │
│ Arbitrary Execution in Installs │ ──► [Zero-Shell Sandbox & AST-Only Mutations]
└─────────────────────────────────┘
┌─────────────────────────────────┐
│     Threat Vector 3:            │
│  Prompt Injection via MCP SDK   │ ──► [Input Schema Whitelisting & Path Anchoring]
└─────────────────────────────────┘
```

### 1.1 Vector 1: Malicious or Compromised Skill Manifests

- **Threat**: A rogue skill author publishes a `skill.json` attempting directory traversal (e.g. `targetFile: "../../../../etc/passwd"`), malicious re-exports, or dependency typosquatting.
- **Mitigations**:
  - **Path Jail & Sanitization**: All `targetFile`, `schemaFiles.source`, and `schemaFiles.target` paths are validated using `path.resolve` and checked against `projectRoot`. Any path resolving outside `projectRoot` is immediately rejected.
  - **Strict Kebab-Case & SemVer Whitelist**: Skill IDs must conform strictly to `^[a-z0-9]+(-[a-z0-9]+)*$` and schema versions to valid SemVer.
  - **Type-Enforced Injections**: Manifests can only declare approved AST injection types (`jsx_wrapper`, `named_export`, `re_export`, `middleware_chain`). Arbitrary script hooks or execution strings are rejected at the schema gate.

### 1.2 Vector 2: Arbitrary Code Execution During Scaffolding

- **Threat**: Traditional package ecosystems suffer from vulnerabilities where packages execute arbitrary bash scripts during `postinstall`.
- **Mitigations**:
  - **No Arbitrary Shell Script Execution**: Vibe Skill does not execute arbitrary shell scripts from skill manifests. Code modification is performed strictly in-process using `ts-morph` AST syntax manipulation.
  - **Sandboxed Database Migrations**: Schema migrations are placed as inert files (e.g., `supabase/migrations/*.sql`) for review rather than blindly piping raw strings to `psql` or executing un-sanitized SQL.

### 1.3 Vector 3: Prompt Injection via MCP Inputs

- **Threat**: An attacker tricks an LLM into calling the MCP `install_skill` tool with corrupted arguments (e.g., pointing `projectPath` to sensitive system root directories).
- **Mitigations**:
  - **Input Validation**: All MCP tool arguments are validated with Zod schemas enforcing non-empty strings and valid directory targets before invocation.
  - **Catalog Verification**: The `install_skill` tool verifies the requested `skillId` against the locally loaded or verified registry catalog; arbitrary unverified IDs cannot trigger injections.

---

## 2. Secret Management & Hygiene

Plain-text secrets in source code repositories represent one of the leading causes of security breaches. Vibe Skill enforces zero-plaintext-secret rules.

### 2.1 Rules for Skill Manifests

- **No Plain-Text Secrets in Manifests or Git**: Skill packages and `skill.json` files must **never** contain live API tokens, service keys, or database passwords.
- **The `secret: true` Flag**: Every environment variable declared in `manifest.env` must specify whether it is sensitive:
  ```json
  {
    "key": "SUPABASE_SERVICE_ROLE_KEY",
    "required": true,
    "secret": true,
    "description": "Admin service role key with elevated privileges"
  }
  ```

### 2.2 Local Environment File Isolation

- All environment variables provisioned by Vibe Skill are appended exclusively to `.env.local` or `.env`.
- `.env.local` and `.env` are strictly included in root `.gitignore`.
- **Placeholder-Only Appending**: The installer generates empty template entries (`KEY=`) with documentation comments. It **never** prompts the user to enter secrets into plain-text terminal logs or LLM context windows unless securely masked.

---

## 3. Static AST Sanitization Standards

To ensure that injected code cannot compromise the target application, the `@vibe-skill/ast-engine` enforces static AST sanitization:

### 3.1 Prohibited Language Constructs

The AST engine refuses to inject or scaffold templates containing dangerous JavaScript/TypeScript constructs:

- **Dynamic Code Evaluation**: Usage of `eval(...)`, `new Function(...)`, or Node.js `vm.runInThisContext(...)` is strictly banned.
- **Unrestricted Child Processes**: Direct calls to `child_process.exec()` or `child_process.execSync()` with dynamic string concatenation are prohibited.
- **Global Scope Poisoning**: Modifying native prototypes (`Object.prototype`, `Array.prototype`) is forbidden.

### 3.2 Module Specifier Validation

When injecting imports (`import { X } from 'module'`):

- Relative module specifiers must resolve strictly within the project tree.
- External module specifiers must match valid npm package naming conventions (`^[a-zA-Z0-9@/._-]+$`) and must match dependencies declared in `manifest.dependencies.npm`.

---

## 4. Vulnerability Disclosure & Incident Response

We welcome responsible, coordinated disclosure of security vulnerabilities from security researchers and the open-source community.

### 4.1 Reporting a Vulnerability

- **Do NOT report security vulnerabilities via public GitHub issues.**
- Please report potential vulnerabilities privately via:
  - **Email**: `security@vibe-skill.org`
  - **GitHub Security Advisories**: Use the "Report a vulnerability" button on our GitHub repository.

### 4.2 Required Information

To help us triage and resolve the issue quickly, please include:

1. Description of the vulnerability and attack vector.
2. Step-by-step reproduction instructions or a minimal Proof of Concept (PoC).
3. Affected components (`apps/cli`, `apps/mcp-server`, `packages/ast-engine`, etc.).
4. Potential impact or severity assessment (CVSS if available).

### 4.3 Response Timeline & SLAs

- **Acknowledgment**: Within **48 hours** of initial receipt.
- **Triage & Assessment**: Within **5 business days**, confirming severity and scope.
- **Patch Development & Release**: Within **14–30 business days** depending on vulnerability complexity.
- **Public Disclosure**: Coordinated release of security advisory and CVE assignment following patch availability.
