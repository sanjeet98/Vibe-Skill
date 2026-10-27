#!/usr/bin/env node

/**
 * @antigravity/cli
 * Command-line interface for Antigravity skills registry and AST scaffolding engine.
 */

import { ASTEngine } from "@antigravity/ast-engine";
import { RegistryClient } from "@antigravity/infra-core";
import type { SkillManifest } from "@antigravity/manifest";

export async function runCli(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0] || "help";

  console.log(`Antigravity CLI v0.1.0`);
  console.log(`Command received: ${command}`);
}

if (process.env.NODE_ENV !== "test") {
  runCli().catch((err) => {
    console.error("Fatal CLI Error:", err);
    process.exit(1);
  });
}
