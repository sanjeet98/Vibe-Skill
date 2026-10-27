/**
 * @antigravity/ast-engine
 * Abstract Syntax Tree transformations and scaffolding engine.
 */

import type { SkillManifest } from "@antigravity/manifest";

export interface ASTTransformContext {
  filePath: string;
  sourceCode: string;
  manifest?: SkillManifest;
}

export interface ASTTransformResult {
  filePath: string;
  transformedCode: string;
  hasChanged: boolean;
}

export class ASTEngine {
  constructor(private readonly options: Record<string, unknown> = {}) {}

  async transform(context: ASTTransformContext): Promise<ASTTransformResult> {
    return {
      filePath: context.filePath,
      transformedCode: context.sourceCode,
      hasChanged: false,
    };
  }
}
