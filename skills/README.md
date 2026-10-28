# Vibe Skill Canonical Blueprints & Skills Catalog

This directory hosts production-grade agent skill blueprints, codemods, and reusable capability definitions for the **Vibe Skill** platform.

---

## 1. Skill Blueprint Layout

Every verified skill follows the standard structure enforced by `@vibe-skill/manifest`:

```text
skills/<skill-id>/
├── skill.json              # Canonical manifest conforming to SkillManifestSchema
├── agent/
│   └── rules.md            # High-context architectural coding guidelines for AI agents
└── template/               # Scaffolding templates and migrations
    ├── components/         # React / UI client components (e.g. AuthProvider)
    ├── lib/                # Shared utilities and SDK client factories (e.g. Supabase client)
    ├── middleware.ts       # Route guards and session lifecycle hooks
    └── schema/             # Database DDL migrations and role schemas (*.sql)
```

---

## 2. Canonical Skills Catalog

| Skill ID                 | Name                   | Framework          | Auth / DB Provider    | Description                                                                                                                                 |
| :----------------------- | :--------------------- | :----------------- | :-------------------- | :------------------------------------------------------------------------------------------------------------------------------------------ |
| **`auth-supabase-rbac`** | Supabase Auth & RBAC   | Next.js App Router | Supabase / PostgreSQL | Production-grade Supabase Authentication with Role-Based Access Control (RBAC), SSR cookie handling, and Row-Level Security (RLS) policies. |
| **`auth-clerk-nextjs`**  | Clerk Authentication   | Next.js App Router | Clerk                 | Instant authentication and user management with `<ClerkProvider>` AST wrapping and middleware route guards.                                 |
| **`db-drizzle-pg`**      | Drizzle ORM PostgreSQL | Next.js / Vite     | PostgreSQL (Drizzle)  | Type-safe PostgreSQL client configuration with Drizzle ORM, schema declarations, and migration pipelines.                                   |

---

## 3. Installation

Skills can be installed via CLI or MCP Server:

### Via CLI:

```bash
vibe-skill add skills/auth-supabase-rbac
# Or by registered ID:
vibe-skill add auth-supabase-rbac
```

### Via MCP Server:

AI agents invoke the `install_skill` tool:

```json
{
  "projectPath": "/absolute/path/to/target-project",
  "skillId": "auth-supabase-rbac"
}
```
