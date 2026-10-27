# Drizzle ORM Coding Guidelines

1. Define database tables in `src/db/schema/*.ts`.
2. Re-export all schemas in `src/db/schema/index.ts`.
3. Use the centralized `db` client exported from `src/db/index.ts`.
