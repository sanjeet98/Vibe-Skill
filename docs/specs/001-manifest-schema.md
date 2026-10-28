# SPEC-001: Vibe Skill Manifest Specification

## Status: Draft

## Version: 0.1.0

## Overview

Defines the schema and structure of a Vibe Skill Package. A skill package packages metadata, triggers, operational rules, tool definitions, and AST transformation templates.

### Schema Fields

- `schemaVersion`: SemVer string of the manifest schema.
- `name`: Unique namespaced identifier (e.g. `@org/skill-name`).
- `version`: Version of the skill package.
- `description`: Human- and agent-readable summary of skill functionality.
- `author`: Author information.
- `capabilities`: Array of exposed tool and AST actions.
- `dependencies`: Dependent skills or package dependencies required for code injection.
